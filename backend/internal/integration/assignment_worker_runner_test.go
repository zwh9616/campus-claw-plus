//go:build integration

package integration

import (
	"bufio"
	"context"
	"errors"
	"os"
	"os/exec"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
)

func TestATRealWorkerBatchConcurrencyAndUnbound(t *testing.T) {
	f := awSetup(t, 43)
	ctx := context.Background()
	for i := 0; i < 24; i++ {
		f.task(t)
	}
	list, e := f.repo.Ready(ctx, 20)
	if e != nil || len(list) != 20 {
		t.Fatal("AT indexed ready scan is not bounded at20")
	}
	if _, e = f.repo.Ready(ctx, 21); !errors.Is(e, identity.ErrInvalid) {
		t.Fatal("AT unbounded batch accepted")
	}
	if assignments.NewWorker(f.repo, nil).Run(ctx) != nil {
		t.Fatal("AT unbound production worker")
	}
	var n int
	f.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE status='running'").Scan(&n)
	if n != 0 {
		t.Fatal("AT unbound executor claimed real work")
	}
	entered := make(chan struct{}, 24)
	var active, peak atomic.Int32
	worker := assignments.NewWorker(f.repo, awExecutor(func(ctx context.Context, _ assignments.Work) ([]byte, error) {
		n := active.Add(1)
		defer active.Add(-1)
		for old := peak.Load(); n > old; old = peak.Load() {
			if peak.CompareAndSwap(old, n) {
				break
			}
		}
		entered <- struct{}{}
		<-ctx.Done()
		return nil, ctx.Err()
	}))
	running, cancel := context.WithCancel(ctx)
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- worker.Run(running) }()
	awSignal(t, entered)
	awSignal(t, entered)
	f.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE status='running'").Scan(&n)
	if n != 2 || peak.Load() != 2 {
		t.Fatal("AT actual scheduler exceeded two executors")
	}
	cancel()
	select {
	case e := <-done:
		if e != nil {
			t.Fatal("AT real scheduler shutdown")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("AT shutdown did not cancel execution/stop renewals")
	}
	if count(t, f.db, "test_task_receipts") != 0 {
		t.Fatal("AT shutdown fabricated a result")
	}
}

func TestATActualWorkerSIGTERM(t *testing.T) {
	f := awSetup(t, 44)
	a := f.task(t)
	// The helper normally targets its own crash-test database. Its DB selection
	// is test-binary-only and cannot be enabled in the production server.
	cmd := exec.Command(os.Args[0], "-test.run=^TestATWorkerCrashHelper$", "-test.timeout=30s")
	cmd.Env = append(os.Environ(), "AT_WORKER_CHILD=graceful", "AT_WORKER_CHILD_DB=44")
	pipe, e := cmd.StdoutPipe()
	if e != nil {
		t.Fatal("AT SIGTERM helper pipe")
	}
	if cmd.Start() != nil {
		t.Fatal("AT SIGTERM helper start")
	}
	t.Cleanup(func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	})
	ready := make(chan struct{}, 1)
	go func() {
		scan := bufio.NewScanner(pipe)
		for scan.Scan() {
			if scan.Text() == "AT_WORKER_READY" {
				ready <- struct{}{}
				return
			}
		}
	}()
	awSignal(t, ready)
	started := time.Now()
	if cmd.Process.Signal(syscall.SIGTERM) != nil {
		t.Fatal("AT signal only launched worker")
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case e := <-done:
		if e != nil {
			t.Fatal("AT graceful worker returned failure")
		}
	case <-time.After(11 * time.Second):
		t.Fatal("AT SIGTERM exceeded ten-second drain")
	}
	if time.Since(started) > 10*time.Second {
		t.Fatal("AT drain exceeded10 seconds")
	}
	if task := f.get(t, a.TaskID); task.Status != "running" || task.Attempt != 1 || task.Error != nil {
		t.Fatal("AT SIGTERM lost durable lease or fabricated failure")
	}
	if count(t, f.db, "test_task_receipts") != 0 {
		t.Fatal("AT shutdown wrote a result")
	}
}
