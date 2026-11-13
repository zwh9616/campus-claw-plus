package assignments

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type executorFunc func(context.Context, Work) ([]byte, error)

func (f executorFunc) Execute(ctx context.Context, w Work) ([]byte, error) { return f(ctx, w) }

type workerProbe struct {
	mu              sync.Mutex
	claimed         map[string]bool
	ready           chan struct{}
	finished        chan Completion
	renewed         chan struct{}
	cancelRequested bool
	limit           int
}

func (p *workerProbe) Ready(_ context.Context, limit int) ([]Candidate, error) {
	p.mu.Lock()
	p.limit = limit
	p.mu.Unlock()
	select {
	case p.ready <- struct{}{}:
	default:
	}
	return []Candidate{{TaskID: "1"}, {TaskID: "2"}, {TaskID: "3"}}, nil
}
func (p *workerProbe) Claim(_ context.Context, c Candidate, owner string) (Work, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.claimed[c.TaskID] {
		return Work{}, ErrLeaseLost
	}
	p.claimed[c.TaskID] = true
	return Work{Lease: Lease{TaskID: c.TaskID, Owner: owner, Epoch: 1}}, nil
}
func (*workerProbe) RecoverExpired(context.Context, Candidate) error { return nil }
func (p *workerProbe) Renew(context.Context, Lease) (bool, error) {
	select {
	case p.renewed <- struct{}{}:
	default:
	}
	return p.cancelRequested, nil
}
func (p *workerProbe) Complete(_ context.Context, _ Lease, c Completion) error {
	p.finished <- c
	return nil
}
func probe() *workerProbe {
	return &workerProbe{claimed: map[string]bool{}, ready: make(chan struct{}, 10), finished: make(chan Completion, 10), renewed: make(chan struct{}, 10)}
}
func await(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(time.Second):
		t.Fatal("worker control boundary timed out")
	}
}

func TestATWorkerUnboundAndBoundedShutdown(t *testing.T) {
	if NewWorker(nil, nil).Run(context.Background()) != nil {
		t.Fatal("unbound executor queried/claimed work")
	}
	p := probe()
	entered := make(chan struct{}, 3)
	var active, peak atomic.Int32
	ex := executorFunc(func(ctx context.Context, w Work) ([]byte, error) {
		n := active.Add(1)
		defer active.Add(-1)
		for old := peak.Load(); n > old; old = peak.Load() {
			if peak.CompareAndSwap(old, n) {
				break
			}
		}
		if len(w.Lease.Owner) != 32 {
			t.Error("owner is not an unpredictable session ID")
		}
		entered <- struct{}{}
		<-ctx.Done()
		return nil, ctx.Err()
	})
	w := NewWorker(p, ex)
	poll := make(chan time.Time, 2)
	w.after = func(d time.Duration) <-chan time.Time {
		if d == PollInterval {
			return poll
		}
		return time.After(d)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- w.Run(ctx) }()
	await(t, entered)
	await(t, entered)
	await(t, p.ready)
	poll <- time.Now()
	await(t, p.ready)
	cancel()
	select {
	case e := <-done:
		if e != nil {
			t.Fatal("cooperative shutdown failed")
		}
	case <-time.After(time.Second):
		t.Fatal("shutdown failed to stop claims/renewal")
	}
	p.mu.Lock()
	count, limit := len(p.claimed), p.limit
	p.mu.Unlock()
	if peak.Load() != 2 || count != 2 || limit != 20 {
		t.Fatal("worker exceeded two executors/twenty observations")
	}
	if len(p.finished) != 0 {
		t.Fatal("shutdown wrote a fabricated failure/cancellation")
	}
}
func TestATWorkerHeartbeatCancellationAndDrainBudget(t *testing.T) {
	t.Run("heartbeat", func(t *testing.T) {
		p := probe()
		p.cancelRequested = true
		p.claimed["2"] = true
		p.claimed["3"] = true
		entered := make(chan struct{}, 1)
		heartbeat := make(chan time.Time, 1)
		requested := make(chan struct{}, 1)
		w := NewWorker(p, executorFunc(func(ctx context.Context, _ Work) ([]byte, error) {
			entered <- struct{}{}
			<-ctx.Done()
			return nil, ctx.Err()
		}))
		w.after = func(d time.Duration) <-chan time.Time {
			if d == HeartbeatInterval {
				select {
				case requested <- struct{}{}:
				default:
				}
				return heartbeat
			}
			return time.After(d)
		}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		done := make(chan error, 1)
		go func() { done <- w.Run(ctx) }()
		await(t, entered)
		await(t, requested)
		heartbeat <- time.Now()
		await(t, p.renewed)
		select {
		case out := <-p.finished:
			if out.Kind != CompleteCancel {
				t.Fatal("heartbeat cancellation became failure/success")
			}
		case <-time.After(time.Second):
			t.Fatal("cancellation was not confirmed")
		}
		cancel()
		if e := <-done; e != nil {
			t.Fatal("heartbeat worker shutdown")
		}
	})
	t.Run("drain limit", func(t *testing.T) {
		p := probe()
		p.claimed["2"] = true
		p.claimed["3"] = true
		entered := make(chan struct{}, 1)
		release := make(chan struct{})
		defer close(release)
		drain := make(chan time.Time, 1)
		requested := make(chan struct{}, 1)
		w := NewWorker(p, executorFunc(func(context.Context, Work) ([]byte, error) { entered <- struct{}{}; <-release; return nil, nil }))
		w.after = func(d time.Duration) <-chan time.Time {
			if d == DrainTimeout {
				requested <- struct{}{}
				return drain
			}
			return time.After(d)
		}
		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan error, 1)
		go func() { done <- w.Run(ctx) }()
		await(t, entered)
		cancel()
		await(t, requested)
		drain <- time.Now()
		if e := <-done; !errors.Is(e, ErrDrainTimeout) {
			t.Fatal("uncooperative executor escaped drain budget")
		}
		if e := w.Run(context.Background()); !errors.Is(e, ErrWorkerRunning) {
			t.Fatal("worker restarted over an undrained executor")
		}
		if len(p.finished) != 0 {
			t.Fatal("drain timeout committed a false result")
		}
	})
}
