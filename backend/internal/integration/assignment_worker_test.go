//go:build integration

package integration

import (
	"bufio"
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

type awExecutor func(context.Context, assignments.Work) ([]byte, error)

func (fn awExecutor) Execute(ctx context.Context, w assignments.Work) ([]byte, error) {
	return fn(ctx, w)
}

type awFixture struct {
	*atBusinessFixture
	assignment assignments.Assignment
	offset     atomic.Int64
	sequence   int
}

func awSetup(t *testing.T, number int) *awFixture {
	t.Helper()
	f := &awFixture{atBusinessFixture: atBusinessSetup(t, number)}
	f.assignment = f.create(t, "worker transaction fixture")
	atExec(t, f.db, "CREATE TABLE test_task_receipts(task_id BIGINT UNSIGNED NOT NULL,epoch BIGINT UNSIGNED NOT NULL,state VARCHAR(16) NOT NULL,payload VARBINARY(100),PRIMARY KEY(task_id,epoch)) ENGINE=InnoDB")
	f.repo.AssignmentClock = func(ctx context.Context, tx *sql.Tx) (time.Time, error) {
		var now time.Time
		e := tx.QueryRowContext(ctx, "SELECT TIMESTAMPADD(MICROSECOND,?,created_at) FROM assignments WHERE id=?", f.offset.Load()*1000, f.assignment.ID).Scan(&now)
		return now, e
	}
	f.repo.AssignmentReceipt = func(ctx context.Context, tx *sql.Tx, r assignments.Receipt) error {
		_, e := tx.ExecContext(ctx, "INSERT INTO test_task_receipts(task_id,epoch,state,payload) VALUES(?,?,?,?)", r.TaskID, r.Epoch, r.Status, r.Payload)
		return e
	}
	return f
}
func (f *awFixture) task(t *testing.T) assignments.Accepted {
	t.Helper()
	f.sequence++
	out, e := f.repo.SubmitAssignment(context.Background(), f.users["student-a"].Body.Principal, f.assignment.ID, fmt.Sprintf("worker-fixture-%04d", f.sequence), assignments.SubmitInput{Answer: "private worker fixture answer", Version: assignments.Version{Value: 1}}, func() error { return nil })
	if e != nil {
		t.Fatal("AT worker real submission")
	}
	return out
}
func (f *awFixture) candidate(t *testing.T, id string) assignments.Candidate {
	t.Helper()
	task, e := f.repo.GetTask(context.Background(), f.users["student-a"].Body.Principal, id)
	if e != nil {
		t.Fatal("AT worker real task read")
	}
	return assignments.Candidate{TaskID: id, Epoch: task.Epoch, Version: task.Version, Cleanup: task.Status == "running" && (task.CancelRequested || task.Attempt == 3)}
}
func (f *awFixture) claim(t *testing.T, id, owner string) assignments.Work {
	t.Helper()
	v, e := f.repo.Claim(context.Background(), f.candidate(t, id), owner)
	if e != nil {
		t.Fatal("AT valid worker claim")
	}
	return v
}
func (f *awFixture) get(t *testing.T, id string) assignments.Task {
	t.Helper()
	v, e := f.repo.GetTask(context.Background(), f.users["student-a"].Body.Principal, id)
	if e != nil {
		t.Fatal("AT task snapshot")
	}
	return v
}
func (f *awFixture) fingerprint(t *testing.T, id string) [32]byte {
	t.Helper()
	var row string
	e := f.db.QueryRow("SELECT JSON_OBJECT('status',t.status,'attempt',t.attempt,'epoch',t.execution_epoch,'version',t.version,'cancel',t.cancel_requested,'owner',t.worker_owner,'lease',CAST(t.lease_until AS CHAR),'updated',CAST(t.updated_at AS CHAR),'error',t.error_code,'delivery',o.delivery_state,'available',CAST(o.available_at AS CHAR),'receipts',(SELECT COUNT(*) FROM test_task_receipts r WHERE r.task_id=t.id)) FROM tasks t JOIN task_outbox o ON o.task_id=t.id WHERE t.id=?", id).Scan(&row)
	if e != nil {
		t.Fatal("AT transaction fingerprint")
	}
	return sha256.Sum256([]byte(row))
}
func awLost(t *testing.T, e error) {
	t.Helper()
	if !errors.Is(e, assignments.ErrLeaseLost) {
		t.Fatal("AT stale worker mutation was not rejected")
	}
}

func TestATWorkerLeaseExpiryTakeoverAndABA(t *testing.T) {
	f := awSetup(t, 37)
	ctx := context.Background()
	a := f.task(t)
	firstObservation := f.candidate(t, a.TaskID)
	w := f.claim(t, a.TaskID, strings.Repeat("a", 32))
	initial := f.get(t, a.TaskID)
	if initial.Attempt != 1 || initial.Epoch != 1 || initial.Version != 2 || w.Answer != "private worker fixture answer" {
		t.Fatal("AT first claim counters/input")
	}
	_, e := f.repo.Claim(ctx, firstObservation, strings.Repeat("b", 32))
	awLost(t, e)
	f.offset.Store(20000)
	if cancelled, e := f.repo.Renew(ctx, w.Lease); e != nil || cancelled {
		t.Fatal("AT heartbeat under valid lease")
	}
	if f.get(t, a.TaskID) != initial {
		t.Fatal("AT heartbeat changed public version/time")
	}
	var leaseSeconds int
	if f.db.QueryRow("SELECT TIMESTAMPDIFF(SECOND,a.created_at,t.lease_until) FROM tasks t JOIN submissions s ON s.id=t.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE t.id=?", a.TaskID).Scan(&leaseSeconds) != nil || leaseSeconds != 80 {
		t.Fatal("AT heartbeat is not now plus60 seconds")
	}
	for _, bad := range []assignments.Lease{{TaskID: w.Lease.TaskID, SubmissionID: w.Lease.SubmissionID, Owner: strings.Repeat("b", 32), Epoch: 1}, {TaskID: w.Lease.TaskID, SubmissionID: w.Lease.SubmissionID, Owner: w.Lease.Owner, Epoch: 2}} {
		before := f.fingerprint(t, a.TaskID)
		_, e = f.repo.Renew(ctx, bad)
		awLost(t, e)
		awLost(t, f.repo.Complete(ctx, bad, assignments.Completion{Kind: assignments.CompleteSuccess}))
		if f.fingerprint(t, a.TaskID) != before {
			t.Fatal("AT owner/epoch mismatch wrote")
		}
	}
	f.offset.Store(60000) // A stale observation at the old expiry cannot steal a renewed lease.
	renewed := f.fingerprint(t, a.TaskID)
	_, e = f.repo.Claim(ctx, f.candidate(t, a.TaskID), strings.Repeat("f", 32))
	awLost(t, e)
	if renewed != f.fingerprint(t, a.TaskID) {
		t.Fatal("AT takeover ignored the renewed lease")
	}
	f.offset.Store(80000) // exact DB-selected lease expiry, no successor yet.
	before := f.fingerprint(t, a.TaskID)
	_, e = f.repo.Renew(ctx, w.Lease)
	awLost(t, e)
	for _, kind := range []assignments.CompletionKind{assignments.CompleteSuccess, assignments.CompleteFailure, assignments.CompleteRetry, assignments.CompleteCancel} {
		awLost(t, f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: kind, Payload: []byte("synthetic receipt")}))
	}
	if f.fingerprint(t, a.TaskID) != before {
		t.Fatal("AT expired unclaimed lease changed state/result/event")
	}
	w2 := f.claim(t, a.TaskID, strings.Repeat("c", 32))
	if w2.Lease.Epoch != 2 || w2.Attempt != 2 {
		t.Fatal("AT takeover did not advance total claims/epoch")
	}
	awLost(t, f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: assignments.CompleteSuccess}))
	if e = f.repo.Complete(ctx, w2.Lease, assignments.Completion{Kind: assignments.CompleteFailure}); e != nil {
		t.Fatal("AT nonretryable failure")
	}
	failed := f.get(t, a.TaskID)
	if failed.Status != "failed" || failed.Error == nil || failed.Error.Code != "EXECUTION_FAILED" {
		t.Fatal("AT unsafe failure snapshot")
	}
	if _, e = f.service.Change(ctx, f.users["student-a"].Body.Principal, a.TaskID, "retry", assignments.Version{Value: failed.Version}); e != nil {
		t.Fatal("AT manual retry")
	}
	if task := f.get(t, a.TaskID); task.Attempt != 2 || task.Epoch != 2 || task.Error != nil {
		t.Fatal("AT manual retry reset counters")
	}
	// Even reusing an owner string cannot give its previous epoch authority.
	w3 := f.claim(t, a.TaskID, w.Lease.Owner)
	if w3.Lease.Epoch != 3 || w3.Attempt != 3 {
		t.Fatal("AT ABA claim reused epoch")
	}
	awLost(t, f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: assignments.CompleteSuccess}))
	if e = f.repo.Complete(ctx, w3.Lease, assignments.Completion{Kind: assignments.CompleteSuccess, Payload: []byte("synthetic receipt")}); e != nil {
		t.Fatal("AT current lease success")
	}
	before = f.fingerprint(t, a.TaskID)
	awLost(t, f.repo.Complete(ctx, w3.Lease, assignments.Completion{Kind: assignments.CompleteSuccess}))
	if before != f.fingerprint(t, a.TaskID) {
		t.Fatal("AT duplicate result modified terminal state")
	}
	if task := f.get(t, a.TaskID); task.Status != "succeeded" || task.Error != nil || task.CancelRequested || task.Attempt != 3 {
		t.Fatal("AT terminal success snapshot")
	}
	var n int
	f.db.QueryRow("SELECT COUNT(*) FROM test_task_receipts WHERE task_id=? AND state='succeeded'", a.TaskID).Scan(&n)
	if n != 1 {
		t.Fatal("AT more than one success receipt")
	}
}

func TestATWorkerBackoffThirdExpiryAndRecoveryCAS(t *testing.T) {
	f := awSetup(t, 38)
	ctx := context.Background()
	a := f.task(t)
	for attempt := 1; attempt <= 3; attempt++ {
		w := f.claim(t, a.TaskID, strings.Repeat("d", 32))
		if w.Attempt != attempt || w.Lease.Epoch != uint64(attempt) {
			t.Fatal("AT lifetime claim count")
		}
		if e := f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: assignments.CompleteRetry}); e != nil {
			t.Fatal("AT retryable failure")
		}
		task := f.get(t, a.TaskID)
		if attempt < 3 {
			if task.Status != "pending" || task.Error != nil || task.CancelRequested {
				t.Fatal("AT backoff snapshot")
			}
			var available, now time.Time
			f.db.QueryRow("SELECT o.available_at,TIMESTAMPADD(MICROSECOND,?,a.created_at) FROM task_outbox o JOIN tasks t ON t.id=o.task_id JOIN submissions s ON s.id=t.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE t.id=?", f.offset.Load()*1000, a.TaskID).Scan(&available, &now)
			if available.Sub(now) != time.Duration(attempt)*time.Second {
				t.Fatal("AT backoff is not1/2 seconds")
			}
			before := f.fingerprint(t, a.TaskID)
			_, e := f.repo.Claim(ctx, f.candidate(t, a.TaskID), strings.Repeat("e", 32))
			awLost(t, e)
			if f.fingerprint(t, a.TaskID) != before {
				t.Fatal("AT early backoff claim wrote")
			}
			f.offset.Add(int64(attempt) * 1000)
		} else if task.Status != "failed" || task.Error == nil || task.Error.Code != "RETRY_EXHAUSTED" {
			t.Fatal("AT third retryable failure not terminal exhausted")
		}
	}
	_, e := f.repo.Claim(ctx, f.candidate(t, a.TaskID), strings.Repeat("f", 32))
	awLost(t, e)
	task := f.get(t, a.TaskID)
	_, e = f.service.Change(ctx, f.users["student-a"].Body.Principal, a.TaskID, "retry", assignments.Version{Value: task.Version})
	if !errors.Is(e, assignments.ErrRetryExhausted) {
		t.Fatal("AT manual retry escaped third claim")
	}
	// A third expired claim is cleaned by a distinct management transaction.
	b := f.task(t)
	for i := 1; i <= 3; i++ {
		f.claim(t, b.TaskID, strings.Repeat("1", 32))
		if i < 3 {
			f.offset.Add(60000)
		}
	}
	c := f.candidate(t, b.TaskID)
	f.offset.Add(60000)
	before := f.fingerprint(t, b.TaskID)
	bad := c
	bad.Epoch--
	awLost(t, f.repo.RecoverExpired(ctx, bad))
	bad = c
	bad.Version--
	awLost(t, f.repo.RecoverExpired(ctx, bad))
	if f.fingerprint(t, b.TaskID) != before {
		t.Fatal("AT stale cleanup wrote")
	}
	if e = f.repo.RecoverExpired(ctx, c); e != nil {
		t.Fatal("AT expired third claim cleanup")
	}
	if v := f.get(t, b.TaskID); v.Attempt != 3 || v.Status != "failed" || v.Error == nil || v.Error.Code != "RETRY_EXHAUSTED" {
		t.Fatal("AT third expiration fabricated fourth execution")
	}
	awLost(t, f.repo.RecoverExpired(ctx, c))
	_, e = f.repo.Claim(ctx, f.candidate(t, b.TaskID), strings.Repeat("2", 32))
	awLost(t, e)
	// A cancellation accepted during running takes priority over failure/retry.
	for _, kind := range []assignments.CompletionKind{assignments.CompleteFailure, assignments.CompleteRetry} {
		x := f.task(t)
		w := f.claim(t, x.TaskID, strings.Repeat("3", 32))
		v := f.get(t, x.TaskID)
		if _, e = f.service.Change(ctx, f.users["student-a"].Body.Principal, x.TaskID, "cancel", assignments.Version{Value: v.Version}); e != nil {
			t.Fatal("AT running cancel")
		}
		if e = f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: kind}); e != nil || f.get(t, x.TaskID).Status != "cancelled" {
			t.Fatal("AT failure dropped cancellation")
		}
	}
	x := f.task(t)
	f.claim(t, x.TaskID, strings.Repeat("4", 32))
	v := f.get(t, x.TaskID)
	if _, e = f.service.Change(ctx, f.users["student-a"].Body.Principal, x.TaskID, "cancel", assignments.Version{Value: v.Version}); e != nil {
		t.Fatal("AT expiry cancel flag")
	}
	c = f.candidate(t, x.TaskID)
	before = f.fingerprint(t, x.TaskID)
	awLost(t, f.repo.RecoverExpired(ctx, c))
	if f.fingerprint(t, x.TaskID) != before {
		t.Fatal("AT live lease prematurely cleaned")
	}
	f.offset.Add(60000)
	if e = f.repo.RecoverExpired(ctx, c); e != nil || f.get(t, x.TaskID).Status != "cancelled" {
		t.Fatal("AT expired cancel not confirmed")
	}
}

func TestATWorkerTerminalAndClaimRollback(t *testing.T) {
	f := awSetup(t, 39)
	ctx := context.Background()
	for _, kind := range []assignments.CompletionKind{assignments.CompleteSuccess, assignments.CompleteFailure, assignments.CompleteCancel} {
		for step := 1; step <= 3; step++ {
			a := f.task(t)
			w := f.claim(t, a.TaskID, strings.Repeat("5", 32))
			if kind == assignments.CompleteCancel {
				v := f.get(t, a.TaskID)
				if _, e := f.service.Change(ctx, f.users["student-a"].Body.Principal, a.TaskID, "cancel", assignments.Version{Value: v.Version}); e != nil {
					t.Fatal("AT rollback cancel setup")
				}
			}
			before := f.fingerprint(t, a.TaskID)
			f.repo.AssignmentHook = func(stage string, n int) error {
				if stage == "worker-complete" && n == step {
					return errors.New("controlled terminal write failure")
				}
				return nil
			}
			e := f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: kind, Payload: []byte("synthetic receipt")})
			f.repo.AssignmentHook = nil
			if !errors.Is(e, identity.ErrUnavailable) || f.fingerprint(t, a.TaskID) != before {
				t.Fatal("AT partial terminal task/receipt/event")
			}
			if e = f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: kind, Payload: []byte("synthetic receipt")}); e != nil {
				t.Fatal("AT valid lease cannot recover terminal rollback")
			}
		}
	}
	for step := 1; step <= 2; step++ {
		a := f.task(t)
		c := f.candidate(t, a.TaskID)
		before := f.fingerprint(t, a.TaskID)
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "worker-claim" && n == step {
				return errors.New("controlled claim failure")
			}
			return nil
		}
		_, e := f.repo.Claim(ctx, c, strings.Repeat("6", 32))
		f.repo.AssignmentHook = nil
		if !errors.Is(e, identity.ErrUnavailable) || before != f.fingerprint(t, a.TaskID) {
			t.Fatal("AT half committed claim/event")
		}
	}
	// Success without a bound atomic result adapter must fail closed.
	a := f.task(t)
	w := f.claim(t, a.TaskID, strings.Repeat("7", 32))
	before := f.fingerprint(t, a.TaskID)
	writer := f.repo.AssignmentReceipt
	f.repo.AssignmentReceipt = nil
	e := f.repo.Complete(ctx, w.Lease, assignments.Completion{Kind: assignments.CompleteSuccess})
	f.repo.AssignmentReceipt = writer
	if !errors.Is(e, identity.ErrUnavailable) || before != f.fingerprint(t, a.TaskID) {
		t.Fatal("AT missing result adapter fabricated success")
	}
}

// Real subprocess death, not resetting an in-memory repository or manufacturing
// a new session. Child uses the exact Claim code, signals only a fixed marker,
// and is killed by its parent at a transaction boundary.
func TestATWorkerCrashHelper(t *testing.T) {
	stage := os.Getenv("AT_WORKER_CHILD")
	if stage == "" {
		return
	}
	database := "/idf_test_40?"
	if os.Getenv("AT_WORKER_CHILD_DB") == "44" {
		database = "/idf_test_44?"
	}
	app, err := mysqlstore.Open(strings.Replace(os.Getenv("MYSQL_DSN"), "/idf_test_0?", database, 1), os.Getenv("MYSQL_CA_FILE"), false)
	if err != nil {
		t.Fatal("AT crash helper trusted connection")
	}
	defer app.Close()
	repo := &mysqlstore.Store{DB: app}
	if stage == "before" {
		repo.AssignmentHook = func(stage string, _ int) error {
			if stage == "worker-locked" {
				fmt.Println("AT_WORKER_READY")
				select {}
			}
			return nil
		}
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM)
	defer stop()
	worker := assignments.NewWorker(repo, awExecutor(func(ctx context.Context, _ assignments.Work) ([]byte, error) {
		fmt.Println("AT_WORKER_READY")
		<-ctx.Done()
		return nil, ctx.Err()
	}))
	if e := worker.Run(ctx); e != nil {
		t.Fatal("AT real worker subprocess stopped with error")
	}
}
func TestATWorkerCrashBeforeAndAfterClaim(t *testing.T) {
	f := awSetup(t, 40)
	ctx := context.Background()
	a := f.task(t)
	for _, stage := range []string{"before", "after"} {
		cmd := exec.Command(os.Args[0], "-test.run=^TestATWorkerCrashHelper$", "-test.timeout=30s")
		cmd.Env = append(os.Environ(), "AT_WORKER_CHILD="+stage)
		pipe, e := cmd.StdoutPipe()
		if e != nil {
			t.Fatal("AT subprocess pipe")
		}
		if cmd.Start() != nil {
			t.Fatal("AT start real worker process")
		}
		t.Cleanup(func() {
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
		})
		ready := make(chan bool, 1)
		go func() {
			scan := bufio.NewScanner(pipe)
			for scan.Scan() {
				if scan.Text() == "AT_WORKER_READY" {
					ready <- true
					return
				}
			}
			ready <- false
		}()
		select {
		case ok := <-ready:
			if !ok {
				t.Fatal("AT child transaction boundary")
			}
		case <-time.After(10 * time.Second):
			t.Fatal("AT child boundary timed out")
		}
		if cmd.Process.Kill() != nil {
			t.Fatal("AT kill only launched worker")
		}
		if cmd.Wait() == nil {
			t.Fatal("AT killed process reported success")
		}
		task := f.get(t, a.TaskID)
		if stage == "before" && task.Status != "pending" {
			t.Fatal("AT death before claim lost pending event")
		}
		if stage == "after" && (task.Status != "running" || task.Attempt != 1) {
			t.Fatal("AT committed claim did not survive process death")
		}
	}
	// Restart the actual scheduler with a new unpredictable process-session
	// owner. Its clock is the exact old persisted expiry, selected from MySQL.
	var until time.Time
	var oldOwner string
	if f.db.QueryRow("SELECT lease_until,worker_owner FROM tasks WHERE id=?", a.TaskID).Scan(&until, &oldOwner) != nil {
		t.Fatal("AT persisted crashed worker lease")
	}
	base, _ := time.Parse(assignments.Timestamp, f.assignment.CreatedAt)
	f.offset.Store(until.Sub(base).Milliseconds())
	committed := make(chan struct{}, 1)
	executed := make(chan assignments.Work, 1)
	worker := assignments.NewWorker(f.repo, awExecutor(func(_ context.Context, w assignments.Work) ([]byte, error) {
		executed <- w
		return []byte("synthetic receipt"), nil
	}))
	worker.Observe = func(event string) {
		if event == "worker completion committed" {
			committed <- struct{}{}
		}
	}
	restart, cancel := context.WithCancel(ctx)
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- worker.Run(restart) }()
	awSignal(t, committed)
	cancel()
	if e := <-done; e != nil {
		t.Fatal("AT restored scheduler shutdown")
	}
	w := <-executed
	if w.Attempt != 2 || w.Lease.Epoch != 2 || w.Lease.Owner == oldOwner {
		t.Fatal("AT restart reused old process session or counters")
	}
	if count(t, f.db, "tasks") != 1 || count(t, f.db, "task_outbox") != 1 || count(t, f.db, "test_task_receipts") != 1 {
		t.Fatal("AT restart duplicated task/event/result")
	}
	// The opaque owner is never returned in a public Task.
	b, _ := f.call(t, "GET", "/api/v1/tasks/"+a.TaskID, "student-a", "", nil, 200)
	if strings.Contains(string(b), "worker_owner") || strings.Contains(string(b), "lease_until") || strings.Contains(string(b), w.Lease.Owner) {
		t.Fatal("AT internal owner escaped")
	}
}
