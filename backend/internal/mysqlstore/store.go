package mysqlstore

import (
	"context"
	"database/sql"
	"errors"
	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"time"
)

type Store struct {
	DB *sql.DB
	// MaterialHook injects transaction failures in tests; production leaves it nil.
	MaterialHook func(stage string, step int) error
	// Assignment hooks are nil in production; deterministic SQL/transaction
	// fault boundaries exist only for integration-test assembly.
	AssignmentHook  func(stage string, step int) error
	AssignmentClock func(context.Context, *sql.Tx) (time.Time, error)
	// A successful execution requires an explicitly bound transaction adapter.
	// Production has no executor or adapter; integration tests use an isolated
	// receipt table. Future 08 writes its own result in this same transaction.
	AssignmentReceipt func(context.Context, *sql.Tx, assignments.Receipt) error
}
type transaction struct {
	tx  *sql.Tx
	ctx context.Context
}

func translated(e error) error {
	if e == nil {
		return nil
	}
	if errors.Is(e, sql.ErrNoRows) {
		return identity.ErrUnauthenticated
	}
	if errors.Is(e, context.DeadlineExceeded) {
		return identity.ErrTimeout
	}
	return identity.ErrUnavailable
}
func (s *Store) Within(ctx context.Context, fn func(identity.Tx) error) error {
	tx, e := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return translated(e)
	}
	defer tx.Rollback()
	if e = fn(&transaction{tx, ctx}); e != nil {
		return e
	}
	// An unsuccessful COMMIT response does not prove rollback. Never retry it.
	if e = tx.Commit(); e != nil {
		return identity.ErrTimeout
	}
	return nil
}
func (t *transaction) user(query string, arg string) (u identity.User, e error) {
	e = t.tx.QueryRowContext(t.ctx, query, arg).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.Enabled, &u.SecurityVersion)
	return u, translated(e)
}

const userCols = "id,username,password_hash,role,enabled,security_version"

func (t *transaction) UserByName(name string) (identity.User, error) {
	return t.user("SELECT "+userCols+" FROM users WHERE username=? FOR UPDATE", name)
}
func (t *transaction) UserByID(id string) (identity.User, error) {
	return t.user("SELECT "+userCols+" FROM users WHERE id=? FOR UPDATE", id)
}
func (t *transaction) Classes(uid string) (ids []string, e error) {
	rows, e := t.tx.QueryContext(t.ctx, "SELECT m.class_id FROM class_memberships m JOIN classes c ON c.id=m.class_id WHERE m.user_id=? AND m.active=1 AND c.active=1 ORDER BY m.class_id", uid)
	if e != nil {
		return nil, translated(e)
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if e = rows.Scan(&id); e != nil {
			return nil, translated(e)
		}
		ids = append(ids, id)
	}
	return ids, translated(rows.Err())
}

const sessionCols = "id,user_id,class_id,version,security_version,refresh_hash,refresh_expires,revoked"

func (t *transaction) session(query string, arg any) (s identity.Session, e error) {
	e = t.tx.QueryRowContext(t.ctx, query, arg).Scan(&s.ID, &s.UserID, &s.ClassID, &s.Version, &s.SecurityVersion, &s.RefreshHash, &s.RefreshExpires, &s.Revoked)
	return s, translated(e)
}
func (t *transaction) SessionByRefresh(hash []byte) (identity.Session, error) {
	// Discover the owner without a lock, then lock owner->session. A contender
	// rechecks the refresh hash AFTER acquiring locks, so only one can rotate it.
	var uid string
	e := t.tx.QueryRowContext(t.ctx, "SELECT user_id FROM sessions WHERE refresh_hash=?", hash).Scan(&uid)
	if e != nil {
		return identity.Session{}, translated(e)
	}
	if _, e = t.UserByID(uid); e != nil {
		return identity.Session{}, e
	}
	return t.session("SELECT "+sessionCols+" FROM sessions WHERE refresh_hash=? FOR UPDATE", hash)
}
func (t *transaction) SessionByID(id string) (identity.Session, error) {
	var uid string
	e := t.tx.QueryRowContext(t.ctx, "SELECT user_id FROM sessions WHERE id=?", id).Scan(&uid)
	if e != nil {
		return identity.Session{}, translated(e)
	}
	if _, e = t.UserByID(uid); e != nil {
		return identity.Session{}, e
	}
	return t.session("SELECT "+sessionCols+" FROM sessions WHERE id=? FOR UPDATE", id)
}
func (t *transaction) AccessByHash(hash []byte) (a identity.Access, e error) {
	e = t.tx.QueryRowContext(t.ctx, "SELECT token_hash,session_id,session_version,expires_at FROM access_credentials WHERE token_hash=?", hash).Scan(&a.Hash, &a.SessionID, &a.Version, &a.Expires)
	return a, translated(e)
}
func (t *transaction) CreateSession(s identity.Session) error {
	_, e := t.tx.ExecContext(t.ctx, "INSERT INTO sessions ("+sessionCols+") VALUES (?,?,?,?,?,?,?,?)", s.ID, s.UserID, s.ClassID, s.Version, s.SecurityVersion, s.RefreshHash, s.RefreshExpires, s.Revoked)
	return translated(e)
}
func (t *transaction) SaveSession(s identity.Session) error {
	_, e := t.tx.ExecContext(t.ctx, "UPDATE sessions SET class_id=?,version=?,refresh_hash=?,refresh_expires=?,revoked=? WHERE id=?", s.ClassID, s.Version, s.RefreshHash, s.RefreshExpires, s.Revoked, s.ID)
	return translated(e)
}
func (t *transaction) CreateAccess(a identity.Access) error {
	_, e := t.tx.ExecContext(t.ctx, "INSERT INTO access_credentials (token_hash,session_id,session_version,expires_at) VALUES (?,?,?,?)", a.Hash, a.SessionID, a.Version, a.Expires)
	return translated(e)
}
func (t *transaction) SaveUser(u identity.User) error {
	_, e := t.tx.ExecContext(t.ctx, "UPDATE users SET password_hash=?,enabled=?,security_version=? WHERE id=?", u.PasswordHash, u.Enabled, u.SecurityVersion, u.ID)
	return translated(e)
}
func (t *transaction) RevokeUser(uid string) error {
	_, e := t.tx.ExecContext(t.ctx, "UPDATE sessions SET revoked=1 WHERE user_id=?", uid)
	return translated(e)
}
func (t *transaction) Audit(a identity.Audit) error {
	_, e := t.tx.ExecContext(t.ctx, "INSERT INTO auth_audit (action,result,user_id,session_id,request_id,occurred_at) VALUES (?,?,NULLIF(?,''),NULLIF(?,''),?,?)", a.Action, a.Result, a.UserID, a.SessionID, a.RequestID, a.At)
	return translated(e)
}
