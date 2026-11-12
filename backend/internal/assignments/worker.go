package assignments

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

const (
	LeaseDuration     = 60 * time.Second
	HeartbeatInterval = 20 * time.Second
	PollInterval      = time.Second
	DrainTimeout      = 10 * time.Second
	ClaimBatch        = 20
	ExecutorLimit     = 2
)

var (
	ErrLeaseLost       = errors.New("task lease is no longer authoritative")
	ErrCancelRequested = errors.New("task cancellation must be confirmed")
	ErrRetryable       = errors.New("temporary execution failure")
	ErrWorkerRunning   = errors.New("worker is already running")
	ErrDrainTimeout    = errors.New("worker drain exceeded its budget")
)

// Candidates are observations, never authority. The repository must recheck
// version, epoch, DB time and current state inside its locking transaction.
type Candidate struct {
	TaskID         string
	Epoch, Version uint64
	Cleanup        bool
}
type Lease struct {
	TaskID, SubmissionID, Owner string
	Epoch                       uint64
}
type Work struct {
	Lease   Lease
	Attempt int
	Answer  string
}
type CompletionKind string

const (
	CompleteSuccess CompletionKind = "succeeded"
	CompleteFailure CompletionKind = "failed"
	CompleteRetry   CompletionKind = "retryable"
	CompleteCancel  CompletionKind = "cancelled"
)

type Completion struct {
	Kind    CompletionKind
	Payload []byte
}

// Receipt is internal, not an HTTP resource/grade. Storage adapters write it
// through the same transaction as the task and event; never do network I/O there.
type Receipt struct {
	TaskID, SubmissionID, Status string
	Epoch                        uint64
	Payload                      []byte
}
type Executor interface {
	Execute(context.Context, Work) ([]byte, error)
}
type WorkerRepository interface {
	Ready(context.Context, int) ([]Candidate, error)
	Claim(context.Context, Candidate, string) (Work, error)
	RecoverExpired(context.Context, Candidate) error
	Renew(context.Context, Lease) (bool, error)
	Complete(context.Context, Lease, Completion) error
}

// Worker has no environment/HTTP mock switch. Production supplies no Executor;
// Run then returns without reading/claiming work. Test binaries explicitly bind
// their executor to this same scheduling and persistent repository code.
type Worker struct {
	Repository WorkerRepository
	Executor   Executor
	Observe    func(string)
	running    atomic.Bool
	after      func(time.Duration) <-chan time.Time
}

func NewWorker(repo WorkerRepository, executor Executor) *Worker {
	return &Worker{Repository: repo, Executor: executor, after: time.After}
}
func (w *Worker) observe(event string) {
	if w.Observe != nil {
		w.Observe(event)
	}
}
func (w *Worker) Run(ctx context.Context) error {
	if w.Executor == nil {
		return nil
	}
	if w.Repository == nil {
		return errors.New("worker repository is unavailable")
	}
	if !w.running.CompareAndSwap(false, true) {
		return ErrWorkerRunning
	}
	var nonce [16]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		w.running.Store(false)
		return errors.New("worker session unavailable")
	}
	owner := hex.EncodeToString(nonce[:])
	slots := make(chan struct{}, ExecutorLimit)
	var jobs sync.WaitGroup
	for ctx.Err() == nil {
		ready, err := w.Repository.Ready(ctx, ClaimBatch)
		if err != nil {
			if ctx.Err() == nil {
				w.observe("worker poll unavailable")
			}
		} else {
			for _, candidate := range ready {
				if ctx.Err() != nil {
					break
				}
				if candidate.Cleanup {
					if err := w.Repository.RecoverExpired(ctx, candidate); err != nil && !errors.Is(err, ErrLeaseLost) && ctx.Err() == nil {
						w.observe("worker recovery unavailable")
					}
					continue
				}
				select {
				case slots <- struct{}{}:
				default:
					continue
				}
				work, err := w.Repository.Claim(ctx, candidate, owner)
				if err != nil {
					<-slots
					if !errors.Is(err, ErrLeaseLost) && ctx.Err() == nil {
						w.observe("worker claim unavailable")
					}
					continue
				}
				if ctx.Err() != nil {
					<-slots
					break
				}
				jobs.Add(1)
				go func() { defer jobs.Done(); defer func() { <-slots }(); w.execute(ctx, work) }()
			}
		}
		select {
		case <-ctx.Done():
		case <-w.after(PollInterval):
		}
	}
	finished := make(chan struct{})
	go func() { jobs.Wait(); close(finished) }()
	select {
	case <-finished:
		w.running.Store(false)
		return nil
	case <-w.after(DrainTimeout):
		return ErrDrainTimeout
	}
}
func (w *Worker) execute(ctx context.Context, work Work) {
	if ctx.Err() != nil {
		return
	}
	execution, cancel := context.WithCancel(ctx)
	defer cancel()
	heartbeat, stop := context.WithCancel(ctx)
	done := make(chan struct{})
	var lost, cancelled atomic.Bool
	go func() {
		defer close(done)
		for {
			select {
			case <-heartbeat.Done():
				return
			case <-w.after(HeartbeatInterval):
				requested, err := w.Repository.Renew(heartbeat, work.Lease)
				if heartbeat.Err() != nil {
					return
				}
				if err != nil {
					lost.Store(true)
					cancel()
					w.observe("worker lease unavailable")
					return
				}
				if requested {
					cancelled.Store(true)
					cancel()
					return
				}
			}
		}
	}()
	payload, err := w.Executor.Execute(execution, work)
	stop()
	<-done
	if ctx.Err() != nil || lost.Load() {
		return
	}
	kind := CompleteSuccess
	if cancelled.Load() {
		kind = CompleteCancel
	} else if err != nil {
		kind = CompleteFailure
		if errors.Is(err, ErrRetryable) || errors.Is(err, context.DeadlineExceeded) {
			kind = CompleteRetry
		}
	}
	err = w.Repository.Complete(ctx, work.Lease, Completion{Kind: kind, Payload: payload})
	if errors.Is(err, ErrCancelRequested) {
		err = w.Repository.Complete(ctx, work.Lease, Completion{Kind: CompleteCancel})
	}
	if err != nil && !errors.Is(err, ErrLeaseLost) && ctx.Err() == nil {
		w.observe("worker completion unavailable")
	} else if err == nil {
		w.observe("worker completion committed")
	}
}
