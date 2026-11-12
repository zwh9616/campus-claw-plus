package mysqlstore

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
)

var workerOwner = regexp.MustCompile(`^[0-9a-f]{32}$`)

func (s *Store) workerTx(ctx context.Context, fn func(context.Context, *sql.Tx) error) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return materialError(ctx, err)
	}
	defer tx.Rollback()
	if err = fn(ctx, tx); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return identity.ErrTimeout
	}
	return nil
}

func (s *Store) Ready(ctx context.Context, limit int) (out []assignments.Candidate, err error) {
	if limit < 1 || limit > assignments.ClaimBatch {
		return nil, identity.ErrInvalid
	}
	err = s.workerTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		now, e := s.assignmentNow(ctx, tx)
		if e != nil {
			return e
		}
		// Separate indexed scans keep expired/cancelled work from starving behind
		// a growing queue, and cap the combined observation batch at twenty.
		queries := []string{
			"SELECT t.id,t.execution_epoch,t.version,(t.cancel_requested=1 OR t.attempt>=3) FROM tasks t FORCE INDEX(ix_task_lease) JOIN task_outbox o ON o.task_id=t.id WHERE t.status='running' AND t.lease_until<=? AND o.delivery_state='leased' ORDER BY t.lease_until,t.id LIMIT ?",
			"SELECT t.id,t.execution_epoch,t.version,0 FROM task_outbox o FORCE INDEX(ix_outbox_delivery) JOIN tasks t ON t.id=o.task_id WHERE o.delivery_state='pending' AND o.available_at<=? AND t.status='pending' AND t.attempt<3 ORDER BY o.available_at,o.task_id LIMIT ?",
		}
		for _, query := range queries {
			if len(out) == limit {
				break
			}
			rows, e := tx.QueryContext(ctx, query, now, limit-len(out))
			if e != nil {
				return materialError(ctx, e)
			}
			for rows.Next() {
				var c assignments.Candidate
				if e = rows.Scan(&c.TaskID, &c.Epoch, &c.Version, &c.Cleanup); e != nil {
					rows.Close()
					return materialError(ctx, e)
				}
				out = append(out, c)
			}
			e = rows.Err()
			rows.Close()
			if e != nil {
				return materialError(ctx, e)
			}
		}
		return nil
	})
	return
}

type workerSnapshot struct {
	Task      assignments.Task
	Until     sql.NullTime
	Available time.Time
	Delivery  string
}

func (s *Store) workerLocked(ctx context.Context, tx *sql.Tx, id string) (v workerSnapshot, err error) {
	if !assignments.ValidID(id) {
		return v, assignments.ErrLeaseLost
	}
	v.Task, err = scanTask(tx.QueryRowContext(ctx, "SELECT "+taskColumns+" FROM tasks t WHERE t.id=? FOR UPDATE", id))
	if errors.Is(err, sql.ErrNoRows) {
		return v, assignments.ErrLeaseLost
	}
	if err != nil {
		return v, materialError(ctx, err)
	}
	err = tx.QueryRowContext(ctx, "SELECT lease_until FROM tasks WHERE id=? FOR UPDATE", id).Scan(&v.Until)
	if err != nil {
		return v, materialError(ctx, err)
	}
	err = tx.QueryRowContext(ctx, "SELECT available_at,delivery_state FROM task_outbox WHERE task_id=? FOR UPDATE", id).Scan(&v.Available, &v.Delivery)
	if err != nil {
		return v, materialError(ctx, err)
	}
	if err = s.assignmentHook(ctx, "worker-locked", 0); err != nil {
		return v, err
	}
	return
}
func observed(v workerSnapshot, c assignments.Candidate) bool {
	return v.Task.Epoch == c.Epoch && v.Task.Version == c.Version
}

func (s *Store) Claim(ctx context.Context, c assignments.Candidate, owner string) (work assignments.Work, err error) {
	if !workerOwner.MatchString(owner) {
		return work, identity.ErrInvalid
	}
	err = s.workerTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := s.workerLocked(ctx, tx, c.TaskID)
		if e != nil {
			return e
		}
		// Read database time after acquiring both locks; lock waits cannot grant
		// authority using the timestamp from an earlier observation.
		now, e := s.assignmentNow(ctx, tx)
		if e != nil {
			return e
		}
		if !observed(v, c) || v.Task.CancelRequested || v.Task.Attempt >= 3 {
			return assignments.ErrLeaseLost
		}
		pending := v.Task.Status == "pending" && v.Delivery == "pending" && !v.Available.After(now)
		expired := v.Task.Status == "running" && v.Delivery == "leased" && v.Until.Valid && !v.Until.Time.After(now)
		if !pending && !expired {
			return assignments.ErrLeaseLost
		}
		r, e := tx.ExecContext(ctx, "UPDATE tasks SET status='running',attempt=attempt+1,execution_epoch=execution_epoch+1,version=version+1,updated_at=?,worker_owner=?,lease_until=?,error_code=NULL WHERE id=? AND version=? AND execution_epoch=?", now, owner, now.Add(assignments.LeaseDuration), c.TaskID, c.Version, c.Epoch)
		if e != nil {
			return materialError(ctx, e)
		}
		if n, e := r.RowsAffected(); e != nil || n != 1 {
			return assignments.ErrLeaseLost
		}
		if e = s.assignmentHook(ctx, "worker-claim", 1); e != nil {
			return e
		}
		if e = workerEvent(ctx, tx, c.TaskID, "leased", v.Available); e != nil {
			return e
		}
		if e = s.assignmentHook(ctx, "worker-claim", 2); e != nil {
			return e
		}
		work.Lease = assignments.Lease{TaskID: c.TaskID, SubmissionID: v.Task.SubmissionID, Owner: owner, Epoch: v.Task.Epoch + 1}
		work.Attempt = v.Task.Attempt + 1
		return materialError(ctx, tx.QueryRowContext(ctx, "SELECT answer FROM submissions WHERE id=?", v.Task.SubmissionID).Scan(&work.Answer))
	})
	return
}

func workerEvent(ctx context.Context, tx *sql.Tx, id, state string, at time.Time) error {
	_, err := tx.ExecContext(ctx, "UPDATE task_outbox SET delivery_state=?,available_at=? WHERE task_id=?", state, at, id)
	return materialError(ctx, err)
}

// This predicate is evaluated only after the Task/event locks and fresh DB time.
// Holding those locks until the conditional mutation/commit makes comparison and
// setting one indivisible operation. Every worker write shares the full predicate.
func workerAuthority(ctx context.Context, tx *sql.Tx, l assignments.Lease, now time.Time) error {
	var n int
	err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM tasks WHERE id=? AND submission_id=? AND execution_epoch=? AND worker_owner=? AND status='running' AND lease_until>?", l.TaskID, l.SubmissionID, l.Epoch, l.Owner, now).Scan(&n)
	if err != nil {
		return materialError(ctx, err)
	}
	if n != 1 {
		return assignments.ErrLeaseLost
	}
	return nil
}
func (s *Store) Renew(ctx context.Context, l assignments.Lease) (cancelRequested bool, err error) {
	err = s.workerTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := s.workerLocked(ctx, tx, l.TaskID)
		if e != nil {
			return e
		}
		now, e := s.assignmentNow(ctx, tx)
		if e != nil {
			return e
		}
		if e = workerAuthority(ctx, tx, l, now); e != nil {
			return e
		}
		if v.Delivery != "leased" {
			return identity.ErrUnavailable
		}
		_, e = tx.ExecContext(ctx, "UPDATE tasks SET lease_until=? WHERE id=? AND execution_epoch=? AND worker_owner=? AND version=?", now.Add(assignments.LeaseDuration), l.TaskID, l.Epoch, l.Owner, v.Task.Version)
		if e != nil {
			return materialError(ctx, e)
		}
		cancelRequested = v.Task.CancelRequested
		return s.assignmentHook(ctx, "worker-renew", 1)
	})
	return
}

// finishWorker is the transaction boundary for all terminal state/receipt/event
// writes. A future result adapter is mandatory for success and cannot commit its
// result separately. Tests alone create a receipt table; the five SQL files stay
// unchanged and production binds neither executor nor adapter.
func (s *Store) finishWorker(ctx context.Context, tx *sql.Tx, v workerSnapshot, state, code string, at time.Time, payload []byte, stage string) error {
	if state == "succeeded" && s.AssignmentReceipt == nil {
		return identity.ErrUnavailable
	}
	var errorCode any
	if code != "" {
		errorCode = code
	}
	result, err := tx.ExecContext(ctx, "UPDATE tasks SET status=?,error_code=?,cancel_requested=?,worker_owner=NULL,lease_until=NULL,version=version+1,updated_at=? WHERE id=? AND version=? AND execution_epoch=?", state, errorCode, state == "cancelled", at, v.Task.ID, v.Task.Version, v.Task.Epoch)
	if err != nil {
		return materialError(ctx, err)
	}
	if n, e := result.RowsAffected(); e != nil || n != 1 {
		return assignments.ErrLeaseLost
	}
	if err = s.assignmentHook(ctx, stage, 1); err != nil {
		return err
	}
	if s.AssignmentReceipt != nil {
		if state != "succeeded" {
			payload = nil
		}
		err = s.AssignmentReceipt(ctx, tx, assignments.Receipt{TaskID: v.Task.ID, SubmissionID: v.Task.SubmissionID, Epoch: v.Task.Epoch, Status: state, Payload: payload})
		if err != nil {
			return materialError(ctx, err)
		}
	}
	if err = s.assignmentHook(ctx, stage, 2); err != nil {
		return err
	}
	if err = workerEvent(ctx, tx, v.Task.ID, "closed", at); err != nil {
		return err
	}
	return s.assignmentHook(ctx, stage, 3)
}
func (s *Store) Complete(ctx context.Context, l assignments.Lease, out assignments.Completion) error {
	if out.Kind != assignments.CompleteSuccess && out.Kind != assignments.CompleteFailure && out.Kind != assignments.CompleteRetry && out.Kind != assignments.CompleteCancel {
		return identity.ErrInvalid
	}
	return s.workerTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := s.workerLocked(ctx, tx, l.TaskID)
		if e != nil {
			return e
		}
		now, e := s.assignmentNow(ctx, tx)
		if e != nil {
			return e
		}
		if e = workerAuthority(ctx, tx, l, now); e != nil {
			return e
		}
		if v.Delivery != "leased" {
			return identity.ErrUnavailable
		}
		if out.Kind == assignments.CompleteSuccess && v.Task.CancelRequested {
			return assignments.ErrCancelRequested
		}
		state, code := "succeeded", ""
		if v.Task.CancelRequested {
			state = "cancelled"
		} else if out.Kind == assignments.CompleteCancel {
			return assignments.ErrLeaseLost
		} else if out.Kind == assignments.CompleteFailure {
			state, code = "failed", "EXECUTION_FAILED"
		} else if out.Kind == assignments.CompleteRetry {
			if v.Task.Attempt >= 3 {
				state, code = "failed", "RETRY_EXHAUSTED"
			} else {
				result, e := tx.ExecContext(ctx, "UPDATE tasks SET status='pending',error_code=NULL,worker_owner=NULL,lease_until=NULL,version=version+1,updated_at=? WHERE id=? AND version=? AND execution_epoch=?", now, l.TaskID, v.Task.Version, l.Epoch)
				if e != nil {
					return materialError(ctx, e)
				}
				if n, e := result.RowsAffected(); e != nil || n != 1 {
					return assignments.ErrLeaseLost
				}
				if e = s.assignmentHook(ctx, "worker-retry", 1); e != nil {
					return e
				}
				if e = workerEvent(ctx, tx, l.TaskID, "pending", now.Add(time.Duration(v.Task.Attempt)*time.Second)); e != nil {
					return e
				}
				return s.assignmentHook(ctx, "worker-retry", 2)
			}
		}
		return s.finishWorker(ctx, tx, v, state, code, now, out.Payload, "worker-complete")
	})
}
func (s *Store) RecoverExpired(ctx context.Context, c assignments.Candidate) error {
	return s.workerTx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := s.workerLocked(ctx, tx, c.TaskID)
		if e != nil {
			return e
		}
		now, e := s.assignmentNow(ctx, tx)
		if e != nil {
			return e
		}
		if !observed(v, c) || v.Task.Status != "running" || !v.Until.Valid || v.Until.Time.After(now) || v.Delivery != "leased" {
			return assignments.ErrLeaseLost
		}
		state, code := "failed", "RETRY_EXHAUSTED"
		if v.Task.CancelRequested {
			state, code = "cancelled", ""
		} else if v.Task.Attempt < 3 {
			return assignments.ErrLeaseLost
		}
		return s.finishWorker(ctx, tx, v, state, code, now, nil, "worker-recover")
	})
}
