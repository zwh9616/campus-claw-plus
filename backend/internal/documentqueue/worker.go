package documentqueue

import (
	"context"
	"errors"
	"time"
)

// Parse runs outside every SQL transaction. The future RPC adapter must map
// transport failures to the closed parse result, never to a successful body.
type Parse func(context.Context, string, []byte) Result

// Run processes one document at a time. Cancellation leaves an unfinished lease
// for database-clock recovery; it never publishes a result after cancellation.
// Default assembly starts this worker only after exact migration/config checks.
func (s *Store) Run(ctx context.Context, parse Parse) error {
	return s.run(ctx, parse, time.Second, 20*time.Second)
}
func (s *Store) run(ctx context.Context, parse Parse, poll, heartbeat time.Duration) error {
	if parse == nil {
		return ErrInvalid
	}
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	for {
		if ctx.Err() != nil {
			return nil
		}
		ids, err := s.Ready(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return err
		}
		for _, id := range ids {
			if ctx.Err() != nil {
				return nil
			}
			owner, e := NewOwner()
			if e != nil {
				return e
			}
			w, e := s.Claim(ctx, id, owner)
			if errors.Is(e, ErrLost) || errors.Is(e, ErrExhausted) {
				continue
			}
			if e != nil {
				if ctx.Err() != nil {
					return nil
				}
				return e
			}
			if e = s.execute(ctx, w, parse, heartbeat); e != nil && !errors.Is(e, ErrLost) {
				if ctx.Err() != nil {
					return nil
				}
				return e
			}
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
func (s *Store) execute(ctx context.Context, w Work, parse Parse, heartbeat time.Duration) error {
	parseCtx, cancel := context.WithTimeout(ctx, 35*time.Second)
	defer cancel()
	type answer struct{ result Result }
	// A parser implementation must honor context; the production HTTP client
	// has an independent 35-second total limit. Buffer allows prompt cancel
	// without a sender blocked on a worker which already lost its authority.
	done := make(chan answer, 1)
	go func() { done <- answer{parse(parseCtx, w.Format, w.Original)} }()
	ticker := time.NewTicker(heartbeat)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-parseCtx.Done():
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return s.Finish(ctx, w, Result{Status: "failed", Failure: "parse_timeout"})
		case <-ticker.C:
			if e := s.Renew(ctx, w.Lease); e != nil {
				return e
			}
		case a := <-done:
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if parseCtx.Err() != nil {
				a.result = Result{Status: "failed", Failure: "parse_timeout"}
			}
			if !validResult(w.Format, a.result) {
				a.result = Result{Status: "failed", Failure: "internal_failure"}
			}
			return s.Finish(ctx, w, a.result)
		}
	}
}
