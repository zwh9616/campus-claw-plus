package mysqlstore

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
)

func (s *Store) assignmentHook(ctx context.Context, stage string, step int) error {
	if s.AssignmentHook != nil {
		if e := s.AssignmentHook(stage, step); e != nil {
			return materialError(ctx, e)
		}
	}
	return nil
}
func (s *Store) assignmentNow(ctx context.Context, tx *sql.Tx) (time.Time, error) {
	if e := s.assignmentHook(ctx, "before-clock", 0); e != nil {
		return time.Time{}, e
	}
	var at time.Time
	var e error
	if s.AssignmentClock != nil {
		at, e = s.AssignmentClock(ctx, tx)
	} else {
		e = tx.QueryRowContext(ctx, "SELECT UTC_TIMESTAMP(3)").Scan(&at)
	}
	return at.UTC(), materialError(ctx, e)
}

// Lock user -> session -> current membership, matching identity's lock order.
// Recheck after Me so logout/switch/revocation cannot race a committed write.
func assignmentPrincipal(ctx context.Context, tx *sql.Tx, p identity.Principal, write bool) error {
	if e := assignments.Readable(p); e != nil {
		return e
	}
	lock := " FOR SHARE"
	if write {
		lock = " FOR UPDATE"
	}
	var role string
	var enabled bool
	var security uint64
	e := tx.QueryRowContext(ctx, "SELECT role,enabled,security_version FROM users WHERE id=?"+lock, p.UserID).Scan(&role, &enabled, &security)
	if errors.Is(e, sql.ErrNoRows) {
		return identity.ErrUnauthenticated
	}
	if e != nil {
		return materialError(ctx, e)
	}
	var user, class string
	var version, sessionSecurity uint64
	var revoked bool
	e = tx.QueryRowContext(ctx, "SELECT user_id,class_id,version,security_version,revoked FROM sessions WHERE id=?"+lock, p.SessionID).Scan(&user, &class, &version, &sessionSecurity, &revoked)
	if errors.Is(e, sql.ErrNoRows) {
		return identity.ErrUnauthenticated
	}
	if e != nil {
		return materialError(ctx, e)
	}
	expires, e := time.Parse(assignments.Timestamp, p.ExpiresAt)
	if e != nil || !time.Now().Before(expires) || !enabled || revoked || role != p.Role || user != p.UserID || class != p.ClassID || version != uint64(p.SessionVersion) || security != sessionSecurity {
		return identity.ErrUnauthenticated
	}
	var active, classActive bool
	e = tx.QueryRowContext(ctx, "SELECT m.active,c.active FROM class_memberships m JOIN classes c ON c.id=m.class_id WHERE m.user_id=? AND m.class_id=? FOR SHARE", p.UserID, p.ClassID).Scan(&active, &classActive)
	if errors.Is(e, sql.ErrNoRows) {
		return identity.ErrUnauthenticated
	}
	if e != nil {
		return materialError(ctx, e)
	}
	if !active || !classActive {
		return identity.ErrUnauthenticated
	}
	if p.Role == "student" {
		var n int
		e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM class_memberships m JOIN classes c ON c.id=m.class_id WHERE m.user_id=? AND m.active=1 AND c.active=1", p.UserID).Scan(&n)
		if e != nil {
			return materialError(ctx, e)
		}
		if n != 1 {
			return identity.ErrUnauthenticated
		}
	}
	return nil
}
func (s *Store) assignmentTx(ctx context.Context, p identity.Principal, write bool, fn func(context.Context, *sql.Tx) error) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, e := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead})
	if e != nil {
		return materialError(ctx, e)
	}
	defer tx.Rollback()
	if e = assignmentPrincipal(ctx, tx, p, write); e != nil {
		return e
	}
	if e = fn(ctx, tx); e != nil {
		return e
	}
	if e = tx.Commit(); e != nil {
		return identity.ErrTimeout
	}
	return nil
}

const assignmentColumns = "id,class_id,teacher_id,title,description,deadline,version,created_at"

func scanAssignment(row interface{ Scan(...any) error }) (a assignments.Assignment, e error) {
	var deadline, created time.Time
	e = row.Scan(&a.ID, &a.ClassID, &a.TeacherID, &a.Title, &a.Description, &deadline, &a.Version, &created)
	a.Deadline = deadline.UTC().Format(assignments.Timestamp)
	a.CreatedAt = created.UTC().Format(assignments.Timestamp)
	return
}
func visibleAssignment(ctx context.Context, tx *sql.Tx, p identity.Principal, id string, lock bool) (assignments.Assignment, error) {
	q := "SELECT " + assignmentColumns + " FROM assignments WHERE id=? AND class_id=?"
	if lock {
		q += " FOR UPDATE"
	}
	a, e := scanAssignment(tx.QueryRowContext(ctx, q, id, p.ClassID))
	return a, materialError(ctx, e)
}
func (s *Store) GetAssignment(ctx context.Context, p identity.Principal, id string) (a assignments.Assignment, e error) {
	e = s.assignmentTx(ctx, p, false, func(ctx context.Context, tx *sql.Tx) error {
		var err error
		a, err = visibleAssignment(ctx, tx, p, id, false)
		return err
	})
	return
}
func (s *Store) CreateAssignment(ctx context.Context, p identity.Principal, in assignments.CreateInput, permit assignments.Permit) (a assignments.Assignment, e error) {
	if e = assignments.Action(p, "teacher"); e != nil {
		return
	}
	e = s.assignmentTx(ctx, p, true, func(ctx context.Context, tx *sql.Tx) error {
		deadline, err := time.Parse(assignments.Timestamp, in.Deadline)
		if err != nil || !assignments.ValidCreate(in) {
			return identity.ErrInvalid
		}
		now, err := s.assignmentNow(ctx, tx)
		if err != nil {
			return err
		}
		if !now.Before(deadline) {
			return identity.ErrInvalid
		}
		if err = permit(); err != nil {
			return err
		}
		r, err := tx.ExecContext(ctx, "INSERT INTO assignments(class_id,teacher_id,title,description,deadline,version,created_at) VALUES(?,?,?,?,?,1,?)", p.ClassID, p.UserID, in.Title, in.Description, deadline, now)
		if err != nil {
			return materialError(ctx, err)
		}
		id, err := r.LastInsertId()
		if err != nil || id < 1 {
			return identity.ErrUnavailable
		}
		if err = s.assignmentHook(ctx, "create-assignment", 1); err != nil {
			return err
		}
		a, err = visibleAssignment(ctx, tx, p, strconv.FormatInt(id, 10), false)
		return err
	})
	return
}
func (s *Store) ListAssignments(ctx context.Context, p identity.Principal, page, size int) (out assignments.Page[assignments.Assignment], e error) {
	out = assignments.Page[assignments.Assignment]{Items: []assignments.Assignment{}, Page: page, PageSize: size}
	e = s.assignmentTx(ctx, p, false, func(ctx context.Context, tx *sql.Tx) error {
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM assignments WHERE class_id=?", p.ClassID).Scan(&out.Total); err != nil {
			return materialError(ctx, err)
		}
		if err := s.assignmentHook(ctx, "list-assignments-count", 0); err != nil {
			return err
		}
		rows, err := tx.QueryContext(ctx, "SELECT "+assignmentColumns+" FROM assignments WHERE class_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?", p.ClassID, size, (int64(page)-1)*int64(size))
		if err != nil {
			return materialError(ctx, err)
		}
		defer rows.Close()
		for rows.Next() {
			a, err := scanAssignment(rows)
			if err != nil {
				return materialError(ctx, err)
			}
			out.Items = append(out.Items, a)
		}
		return materialError(ctx, rows.Err())
	})
	return
}
func (s *Store) SubmitAssignment(ctx context.Context, p identity.Principal, id, key string, in assignments.SubmitInput, permit assignments.Permit) (out assignments.Accepted, e error) {
	if e = assignments.Action(p, "student"); e != nil {
		return
	}
	e = s.assignmentTx(ctx, p, true, func(ctx context.Context, tx *sql.Tx) error {
		a, err := visibleAssignment(ctx, tx, p, id, true)
		if err != nil {
			return err
		}
		if !assignments.ValidKey(key) || !assignments.Text(in.Answer, 20000) || (!in.Version.Large && in.Version.Value == 0) {
			return identity.ErrInvalid
		}
		var digest [32]byte
		if !in.Version.Large {
			digest = assignments.Digest(in)
		}
		var stored []byte
		const route = "/api/v1/assignments/{id}/submissions"
		err = tx.QueryRowContext(ctx, "SELECT submission_id,task_id,response_status,payload_digest FROM submission_idempotency WHERE user_id=? AND class_id=? AND route=? AND assignment_id=? AND idempotency_key=? FOR UPDATE", p.UserID, p.ClassID, route, id, []byte(key)).Scan(&out.SubmissionID, &out.TaskID, &out.Status, &stored)
		if err == nil {
			if in.Version.Large || !bytes.Equal(digest[:], stored) {
				return assignments.ErrIdempotencyConflict
			}
			if out.Status != "pending" {
				return identity.ErrUnavailable
			}
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return materialError(ctx, err)
		}
		if !in.Version.Matches(a.Version) {
			return identity.ErrConflict
		}
		now, err := s.assignmentNow(ctx, tx)
		if err != nil {
			return err
		}
		deadline, _ := time.Parse(assignments.Timestamp, a.Deadline)
		if !now.Before(deadline) {
			return identity.ErrConflict
		}
		if err = permit(); err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, "INSERT INTO submissions(assignment_id,class_id,assignment_version,student_id,answer,created_at) VALUES(?,?,?,?,?,?)", id, p.ClassID, a.Version, p.UserID, in.Answer, now)
		if err != nil {
			return materialError(ctx, err)
		}
		sub, err := result.LastInsertId()
		if err != nil || sub < 1 {
			return identity.ErrUnavailable
		}
		out.SubmissionID = strconv.FormatInt(sub, 10)
		if err = s.assignmentHook(ctx, "submit", 1); err != nil {
			return err
		}
		result, err = tx.ExecContext(ctx, "INSERT INTO tasks(submission_id,status,attempt,execution_epoch,version,cancel_requested,created_at,updated_at) VALUES(?,'pending',0,0,1,0,?,?)", out.SubmissionID, now, now)
		if err != nil {
			return materialError(ctx, err)
		}
		task, err := result.LastInsertId()
		if err != nil || task < 1 {
			return identity.ErrUnavailable
		}
		out.TaskID = strconv.FormatInt(task, 10)
		out.Status = "pending"
		if err = s.assignmentHook(ctx, "submit", 2); err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO task_outbox(task_id,available_at,delivery_state) VALUES(?,?,'pending')", out.TaskID, now); err != nil {
			return materialError(ctx, err)
		}
		if err = s.assignmentHook(ctx, "submit", 3); err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO submission_idempotency(user_id,class_id,route,assignment_id,idempotency_key,payload_digest,submission_id,task_id,response_status) VALUES(?,?,?,?,?,?,?,?,'pending')", p.UserID, p.ClassID, route, id, []byte(key), digest[:], out.SubmissionID, out.TaskID); err != nil {
			return materialError(ctx, err)
		}
		return s.assignmentHook(ctx, "submit", 4)
	})
	return
}

const submissionColumns = "s.id,s.assignment_id,s.assignment_version,s.student_id,s.answer,t.id,s.created_at"
const submissionChain = " FROM submissions s JOIN assignments a ON a.id=s.assignment_id AND a.class_id=s.class_id JOIN tasks t ON t.submission_id=s.id"

func submissionScope(p identity.Principal) (string, []any) {
	q := "a.class_id=?"
	args := []any{p.ClassID}
	if p.Role == "student" {
		q += " AND s.student_id=?"
		args = append(args, p.UserID)
	}
	return q, args
}
func scanSubmission(row interface{ Scan(...any) error }) (s assignments.Submission, e error) {
	var created time.Time
	e = row.Scan(&s.ID, &s.AssignmentID, &s.AssignmentVersion, &s.StudentID, &s.Answer, &s.TaskID, &created)
	s.CreatedAt = created.UTC().Format(assignments.Timestamp)
	return
}
func (s *Store) GetSubmission(ctx context.Context, p identity.Principal, id string) (out assignments.Submission, e error) {
	e = s.assignmentTx(ctx, p, false, func(ctx context.Context, tx *sql.Tx) error {
		filter, args := submissionScope(p)
		args = append(args, id)
		var err error
		out, err = scanSubmission(tx.QueryRowContext(ctx, "SELECT "+submissionColumns+submissionChain+" WHERE "+filter+" AND s.id=?", args...))
		return materialError(ctx, err)
	})
	return
}
func (s *Store) ListSubmissions(ctx context.Context, p identity.Principal, id string, page, size int) (out assignments.Page[assignments.Submission], e error) {
	out = assignments.Page[assignments.Submission]{Items: []assignments.Submission{}, Page: page, PageSize: size}
	e = s.assignmentTx(ctx, p, false, func(ctx context.Context, tx *sql.Tx) error {
		if _, err := visibleAssignment(ctx, tx, p, id, false); err != nil {
			return err
		}
		filter, args := submissionScope(p)
		filter += " AND s.assignment_id=?"
		args = append(args, id)
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*)"+submissionChain+" WHERE "+filter, args...).Scan(&out.Total); err != nil {
			return materialError(ctx, err)
		}
		if err := s.assignmentHook(ctx, "list-submissions-count", 0); err != nil {
			return err
		}
		args = append(args, size, (int64(page)-1)*int64(size))
		rows, err := tx.QueryContext(ctx, "SELECT "+submissionColumns+submissionChain+" WHERE "+filter+" ORDER BY s.created_at DESC,s.id DESC LIMIT ? OFFSET ?", args...)
		if err != nil {
			return materialError(ctx, err)
		}
		defer rows.Close()
		for rows.Next() {
			item, err := scanSubmission(rows)
			if err != nil {
				return materialError(ctx, err)
			}
			out.Items = append(out.Items, item)
		}
		return materialError(ctx, rows.Err())
	})
	return
}

const taskColumns = "t.id,t.submission_id,t.status,t.attempt,t.execution_epoch,t.version,t.cancel_requested,t.created_at,t.updated_at,t.error_code"

func scanTask(row interface{ Scan(...any) error }) (t assignments.Task, e error) {
	var created, updated time.Time
	var code sql.NullString
	e = row.Scan(&t.ID, &t.SubmissionID, &t.Status, &t.Attempt, &t.Epoch, &t.Version, &t.CancelRequested, &created, &updated, &code)
	if e != nil {
		return
	}
	t.CreatedAt = created.UTC().Format(assignments.Timestamp)
	t.UpdatedAt = updated.UTC().Format(assignments.Timestamp)
	if code.Valid {
		switch code.String {
		case "EXECUTION_FAILED":
			t.Error = &assignments.TaskError{Code: code.String, Message: "任务执行失败"}
		case "RETRY_EXHAUSTED":
			t.Error = &assignments.TaskError{Code: code.String, Message: "重试次数已用尽"}
		default:
			return t, identity.ErrUnavailable
		}
	}
	minimumVersion := uint64(t.Attempt + 1)
	if t.Status == "failed" || t.Status == "succeeded" || t.Status == "cancelled" {
		minimumVersion++
	}
	if t.Attempt < 0 || t.Attempt > 3 || t.Epoch != uint64(t.Attempt) || t.Version < minimumVersion || updated.Before(created) {
		return t, identity.ErrUnavailable
	}
	switch t.Status {
	case "pending":
		if t.Attempt == 3 || t.CancelRequested || code.Valid {
			return t, identity.ErrUnavailable
		}
	case "running":
		if t.Attempt == 0 || code.Valid {
			return t, identity.ErrUnavailable
		}
	case "succeeded":
		if t.Attempt == 0 || t.CancelRequested || code.Valid {
			return t, identity.ErrUnavailable
		}
	case "failed":
		if t.Attempt == 0 || t.CancelRequested || !code.Valid || (code.String == "RETRY_EXHAUSTED" && t.Attempt != 3) {
			return t, identity.ErrUnavailable
		}
	case "cancelled":
		if !t.CancelRequested || code.Valid {
			return t, identity.ErrUnavailable
		}
	default:
		return t, identity.ErrUnavailable
	}
	return
}
func visibleTask(ctx context.Context, tx *sql.Tx, p identity.Principal, id string, lock bool) (assignments.Task, error) {
	filter, args := submissionScope(p)
	args = append(args, id)
	q := "SELECT " + taskColumns + submissionChain + " WHERE " + filter + " AND t.id=?"
	if lock {
		q += " FOR UPDATE"
	}
	t, e := scanTask(tx.QueryRowContext(ctx, q, args...))
	return t, materialError(ctx, e)
}
func (s *Store) GetTask(ctx context.Context, p identity.Principal, id string) (out assignments.Task, e error) {
	e = s.assignmentTx(ctx, p, false, func(ctx context.Context, tx *sql.Tx) error {
		var err error
		out, err = visibleTask(ctx, tx, p, id, false)
		return err
	})
	return
}
func (s *Store) ChangeTask(ctx context.Context, p identity.Principal, id, action string, v assignments.Version, permit assignments.Permit) (out assignments.Task, e error) {
	if e = assignments.Action(p, "student"); e != nil {
		return
	}
	e = s.assignmentTx(ctx, p, true, func(ctx context.Context, tx *sql.Tx) error {
		if err := s.assignmentHook(ctx, "before-task-action-lock", 0); err != nil {
			return err
		}
		t, err := visibleTask(ctx, tx, p, id, true)
		if err != nil {
			return err
		}
		terminal := t.Status == "succeeded" || t.Status == "failed" || t.Status == "cancelled"
		if action == "cancel" && terminal {
			return assignments.ErrTaskTerminal
		}
		if !v.Matches(t.Version) {
			return identity.ErrConflict
		}
		if action == "retry" {
			if t.Status != "failed" {
				return identity.ErrConflict
			}
			if t.Attempt >= 3 {
				return assignments.ErrRetryExhausted
			}
		} else if action != "cancel" {
			return identity.ErrInvalid
		}
		if err = permit(); err != nil {
			return err
		}
		if action == "cancel" && t.CancelRequested {
			out = t
			return nil
		}
		now, err := s.assignmentNow(ctx, tx)
		if err != nil {
			return err
		}
		closeEvent := false
		if action == "retry" {
			_, err = tx.ExecContext(ctx, "UPDATE tasks SET status='pending',error_code=NULL,cancel_requested=0,worker_owner=NULL,lease_until=NULL,version=version+1,updated_at=? WHERE id=?", now, id)
		} else if t.Status == "pending" {
			_, err = tx.ExecContext(ctx, "UPDATE tasks SET status='cancelled',error_code=NULL,cancel_requested=1,version=version+1,updated_at=? WHERE id=?", now, id)
			closeEvent = true
		} else {
			_, err = tx.ExecContext(ctx, "UPDATE tasks SET cancel_requested=1,version=version+1,updated_at=? WHERE id=?", now, id)
		}
		if err != nil {
			return materialError(ctx, err)
		}
		if err = s.assignmentHook(ctx, "change-task", 1); err != nil {
			return err
		}
		if action == "retry" || closeEvent {
			state := "pending"
			if closeEvent {
				state = "closed"
			}
			r, er := tx.ExecContext(ctx, "UPDATE task_outbox SET delivery_state=?,available_at=? WHERE task_id=?", state, now, id)
			if er != nil {
				return materialError(ctx, er)
			}
			n, er := r.RowsAffected()
			if er != nil || n != 1 {
				return identity.ErrUnavailable
			}
		}
		if err = s.assignmentHook(ctx, "change-task", 2); err != nil {
			return err
		}
		out, err = visibleTask(ctx, tx, p, id, false)
		return err
	})
	return
}
