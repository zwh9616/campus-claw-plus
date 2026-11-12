//go:build integration

package integration

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
)

func awSignal(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(2 * time.Second):
		t.Fatal("AT transaction barrier timed out")
	}
}
func TestATWorkerCancellationSerializations(t *testing.T) {
	f := awSetup(t, 41)
	ctx := context.Background()
	p := f.users["student-a"].Body.Principal
	t.Run("pending cancel commits before claim", func(t *testing.T) {
		a := f.task(t)
		candidate := f.candidate(t, a.TaskID)
		if _, e := f.service.Change(ctx, p, a.TaskID, "cancel", assignments.Version{Value: 1}); e != nil {
			t.Fatal("AT pending cancel")
		}
		before := f.fingerprint(t, a.TaskID)
		_, e := f.repo.Claim(ctx, candidate, strings.Repeat("a", 32))
		awLost(t, e)
		if f.fingerprint(t, a.TaskID) != before {
			t.Fatal("AT cancelled task was claimed")
		}
	})
	t.Run("claim commits before cancel", func(t *testing.T) {
		a := f.task(t)
		candidate := f.candidate(t, a.TaskID)
		locked, release, started := make(chan struct{}), make(chan struct{}), make(chan struct{})
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "before-task-action-lock" {
				close(started)
			}
			if stage == "worker-claim" && n == 1 {
				close(locked)
				<-release
			}
			return nil
		}
		type result struct {
			work assignments.Work
			err  error
		}
		claimed := make(chan result, 1)
		go func() { w, e := f.repo.Claim(ctx, candidate, strings.Repeat("b", 32)); claimed <- result{w, e} }()
		awSignal(t, locked)
		cancelled := make(chan error, 1)
		go func() {
			_, e := f.service.Change(ctx, p, a.TaskID, "cancel", assignments.Version{Value: 1})
			cancelled <- e
		}()
		awSignal(t, started)
		close(release)
		c := <-claimed
		if c.err != nil {
			t.Fatal("AT transaction-barrier claim")
		}
		if e := <-cancelled; !errors.Is(e, identity.ErrConflict) {
			t.Fatal("AT obsolete cancel version overwrote claim")
		}
		f.repo.AssignmentHook = nil
		v := f.get(t, a.TaskID)
		if _, e := f.service.Change(ctx, p, a.TaskID, "cancel", assignments.Version{Value: v.Version}); e != nil {
			t.Fatal("AT current running cancel")
		}
		before := f.fingerprint(t, a.TaskID)
		if e := f.repo.Complete(ctx, c.work.Lease, assignments.Completion{Kind: assignments.CompleteSuccess}); !errors.Is(e, assignments.ErrCancelRequested) {
			t.Fatal("AT success ignored committed cancellation")
		}
		if before != f.fingerprint(t, a.TaskID) {
			t.Fatal("AT rejected success wrote a receipt")
		}
		if requested, e := f.repo.Renew(ctx, c.work.Lease); e != nil || !requested {
			t.Fatal("AT heartbeat did not observe cancellation")
		}
		if e := f.repo.Complete(ctx, c.work.Lease, assignments.Completion{Kind: assignments.CompleteCancel}); e != nil {
			t.Fatal("AT valid worker cancel confirmation")
		}
	})
	t.Run("success commits before cancel", func(t *testing.T) {
		a := f.task(t)
		w := f.claim(t, a.TaskID, strings.Repeat("c", 32))
		v := f.get(t, a.TaskID)
		locked, release, started := make(chan struct{}), make(chan struct{}), make(chan struct{})
		completed := make(chan error, 1)
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "before-task-action-lock" {
				close(started)
			}
			if stage == "worker-complete" && n == 1 {
				close(locked)
				<-release
			}
			return nil
		}
		go func() {
			completed <- f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: assignments.CompleteSuccess, Payload: []byte("synthetic receipt")})
		}()
		awSignal(t, locked)
		cancelled := make(chan error, 1)
		go func() {
			_, e := f.service.Change(ctx, p, a.TaskID, "cancel", assignments.Version{Value: v.Version})
			cancelled <- e
		}()
		awSignal(t, started)
		close(release)
		if e := <-completed; e != nil {
			t.Fatal("AT success commit under barrier")
		}
		if e := <-cancelled; !errors.Is(e, assignments.ErrTaskTerminal) {
			t.Fatal("AT terminal cancellation erased success")
		}
		f.repo.AssignmentHook = nil
		if f.get(t, a.TaskID).Status != "succeeded" {
			t.Fatal("AT success/cancel invalid ordering")
		}
	})
	t.Run("stale cancellation cleanup observation", func(t *testing.T) {
		a := f.task(t)
		f.claim(t, a.TaskID, strings.Repeat("d", 32))
		old := f.candidate(t, a.TaskID)
		if _, e := f.service.Change(ctx, p, a.TaskID, "cancel", assignments.Version{Value: old.Version}); e != nil {
			t.Fatal("AT cleanup cancellation fixture")
		}
		latest := f.candidate(t, a.TaskID)
		f.offset.Add(60000)
		before := f.fingerprint(t, a.TaskID)
		awLost(t, f.repo.RecoverExpired(ctx, old))
		if before != f.fingerprint(t, a.TaskID) {
			t.Fatal("AT stale cleanup ignored version")
		}
		if e := f.repo.RecoverExpired(ctx, latest); e != nil {
			t.Fatal("AT latest expired cancel recovery")
		}
	})
}

func TestATWorkerRecoveryRetryAndAdapterRollback(t *testing.T) {
	f := awSetup(t, 42)
	ctx := context.Background()
	for step := 1; step <= 3; step++ {
		a := f.task(t)
		f.claim(t, a.TaskID, strings.Repeat("e", 32))
		v := f.get(t, a.TaskID)
		if _, e := f.service.Change(ctx, f.users["student-a"].Body.Principal, a.TaskID, "cancel", assignments.Version{Value: v.Version}); e != nil {
			t.Fatal("AT recovery rollback setup")
		}
		c := f.candidate(t, a.TaskID)
		f.offset.Add(60000)
		before := f.fingerprint(t, a.TaskID)
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "worker-recover" && n == step {
				return errors.New("controlled cleanup write failure")
			}
			return nil
		}
		e := f.repo.RecoverExpired(ctx, c)
		f.repo.AssignmentHook = nil
		if !errors.Is(e, identity.ErrUnavailable) || before != f.fingerprint(t, a.TaskID) {
			t.Fatal("AT partial recovery task/receipt/event")
		}
		if e = f.repo.RecoverExpired(ctx, c); e != nil {
			t.Fatal("AT recovery retry after rollback")
		}
	}
	for step := 1; step <= 2; step++ {
		a := f.task(t)
		w := f.claim(t, a.TaskID, strings.Repeat("f", 32))
		before := f.fingerprint(t, a.TaskID)
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "worker-retry" && n == step {
				return errors.New("controlled requeue failure")
			}
			return nil
		}
		e := f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: assignments.CompleteRetry})
		f.repo.AssignmentHook = nil
		if !errors.Is(e, identity.ErrUnavailable) || before != f.fingerprint(t, a.TaskID) {
			t.Fatal("AT partial automatic retry")
		}
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "worker-renew" && n == 1 {
				return errors.New("controlled renewal failure")
			}
			return nil
		}
		f.offset.Add(20000)
		_, e = f.repo.Renew(ctx, w.Lease)
		f.repo.AssignmentHook = nil
		if !errors.Is(e, identity.ErrUnavailable) || before != f.fingerprint(t, a.TaskID) {
			t.Fatal("AT renewal failure changed lease")
		}
	}
	a := f.task(t)
	w := f.claim(t, a.TaskID, strings.Repeat("1", 32))
	before := f.fingerprint(t, a.TaskID)
	writer := f.repo.AssignmentReceipt
	f.repo.AssignmentReceipt = func(ctx context.Context, tx *sql.Tx, r assignments.Receipt) error {
		if e := writer(ctx, tx, r); e != nil {
			return e
		}
		return errors.New("controlled result adapter failure")
	}
	e := f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: assignments.CompleteSuccess, Payload: []byte("synthetic receipt")})
	f.repo.AssignmentReceipt = writer
	if !errors.Is(e, identity.ErrUnavailable) || before != f.fingerprint(t, a.TaskID) {
		t.Fatal("AT result adapter committed outside task transaction")
	}
	bounded, cancel := context.WithTimeout(ctx, 150*time.Millisecond)
	defer cancel()
	f.repo.AssignmentHook = func(stage string, n int) error {
		if stage == "worker-complete" && n == 1 {
			_, e := f.app.ExecContext(bounded, "SELECT SLEEP(2)")
			return e
		}
		return nil
	}
	e = f.repo.Complete(bounded, w.Lease, assignments.Completion{Kind: assignments.CompleteSuccess})
	f.repo.AssignmentHook = nil
	if !errors.Is(e, identity.ErrTimeout) || before != f.fingerprint(t, a.TaskID) {
		t.Fatal("AT worker timeout did not rollback transaction")
	}
}
