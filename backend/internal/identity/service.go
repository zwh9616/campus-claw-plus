package identity

import (
	"context"
	"crypto/subtle"
	"errors"
	"strconv"
	"time"
)

type Service struct {
	repo              Repository
	now               Clock
	origin, dummyHash string
}

func New(repo Repository, now Clock, origin string) (*Service, error) {
	if now == nil {
		now = time.Now
	}
	dummy, err := token()
	if err != nil {
		return nil, err
	}
	hash, err := HashPassword(dummy)
	if err != nil {
		return nil, err
	}
	return &Service{repo: repo, now: now, origin: origin, dummyHash: hash}, nil
}
func (s *Service) transaction(ctx context.Context, fn func(Tx) error) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	err := s.repo.Within(ctx, fn)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return ErrTimeout
	}
	return err
}
func (s *Service) Login(ctx context.Context, username, password, rid string) (out Issued, err error) {
	if !TextLength(username, 1, 64) || !TextLength(password, 1, 128) {
		return out, ErrInvalid
	}
	err = s.transaction(ctx, func(tx Tx) error {
		u, e := tx.UserByName(username)
		if errors.Is(e, ErrUnauthenticated) {
			VerifyPassword(s.dummyHash, password)
			return ErrUnauthenticated
		}
		if e != nil {
			return e
		}
		valid := VerifyPassword(u.PasswordHash, password)
		if !valid || !u.Enabled {
			return ErrUnauthenticated
		}
		classes, e := tx.Classes(u.ID)
		if e != nil {
			return e
		}
		if len(classes) == 0 || (u.Role == "student" && len(classes) != 1) {
			return ErrUnauthenticated
		}
		sid, e := sessionID()
		if e != nil {
			return e
		}
		sess := Session{ID: sid, UserID: u.ID, ClassID: classes[0], Version: 1, SecurityVersion: u.SecurityVersion}
		out, e = s.issue(tx, u, &sess, true)
		if e != nil {
			return e
		}
		return tx.Audit(Audit{"login", "allowed", u.ID, sid, rid, s.now().UTC()})
	})
	if err != nil {
		return Issued{}, err
	}
	return
}
func (s *Service) issue(tx Tx, u User, sess *Session, create bool) (Issued, error) {
	access, e := token()
	if e != nil {
		return Issued{}, e
	}
	refresh, e := token()
	if e != nil {
		return Issued{}, e
	}
	now := s.now().UTC().Truncate(time.Millisecond)
	sess.RefreshHash, _ = Digest(refresh)
	sess.RefreshExpires = now.Add(604800 * time.Second)
	if create {
		e = tx.CreateSession(*sess)
	} else {
		e = tx.SaveSession(*sess)
	}
	if e != nil {
		return Issued{}, e
	}
	hash, _ := Digest(access)
	expires := now.Add(900 * time.Second)
	if e = tx.CreateAccess(Access{hash, sess.ID, sess.Version, expires}); e != nil {
		return Issued{}, e
	}
	return Issued{AuthSession{access, "Bearer", 900, principal(u, *sess, expires)}, refresh}, nil
}
func principal(u User, sess Session, expires time.Time) Principal {
	return Principal{u.ID, u.Role, sess.ClassID, sess.ID, sess.Version, expires.UTC().Format("2006-01-02T15:04:05.000Z")}
}
func (s *Service) valid(tx Tx, sess Session) (User, error) {
	u, e := tx.UserByID(sess.UserID)
	if e != nil {
		return u, e
	}
	if !u.Enabled || sess.Revoked || u.SecurityVersion != sess.SecurityVersion {
		return u, ErrUnauthenticated
	}
	classes, e := tx.Classes(u.ID)
	if e != nil {
		return u, e
	}
	if u.Role == "student" && len(classes) != 1 {
		return u, ErrUnauthenticated
	}
	for _, id := range classes {
		if id == sess.ClassID {
			return u, nil
		}
	}
	return u, ErrUnauthenticated
}
func (s *Service) access(tx Tx, raw string) (User, Session, Access, error) {
	hash, e := Digest(raw)
	if e != nil {
		return User{}, Session{}, Access{}, e
	}
	a, e := tx.AccessByHash(hash)
	if e != nil {
		return User{}, Session{}, a, e
	}
	sess, e := tx.SessionByID(a.SessionID)
	if e != nil {
		return User{}, sess, a, e
	}
	u, e := s.valid(tx, sess)
	if e != nil {
		return u, sess, a, e
	}
	if !s.now().Before(a.Expires) || a.Version != sess.Version {
		return u, sess, a, ErrUnauthenticated
	}
	return u, sess, a, nil
}
func (s *Service) refresh(tx Tx, raw string) (User, Session, error) {
	hash, e := Digest(raw)
	if e != nil {
		return User{}, Session{}, e
	}
	sess, e := tx.SessionByRefresh(hash)
	if e != nil {
		return User{}, sess, e
	}
	u, e := s.valid(tx, sess)
	if e != nil {
		return u, sess, e
	}
	if !s.now().Before(sess.RefreshExpires) {
		return u, sess, ErrUnauthenticated
	}
	return u, sess, nil
}
func (s *Service) Me(ctx context.Context, access string) (p Principal, err error) {
	err = s.transaction(ctx, func(tx Tx) error {
		u, se, a, e := s.access(tx, access)
		if e != nil {
			return e
		}
		p = principal(u, se, a.Expires)
		return nil
	})
	return
}

// AuthorizeResource revalidates the persistent session before every decision;
// callers supply a resource fetched by their own trusted repository.
func (s *Service) AuthorizeResource(ctx context.Context, access string, action Action, resource Resource) error {
	p, err := s.Me(ctx, access)
	if err != nil {
		return err
	}
	return Authorize(p, action, resource)
}
func (s *Service) GetCSRF(ctx context.Context, refresh string) (value string, err error) {
	err = s.transaction(ctx, func(tx Tx) error {
		_, se, e := s.refresh(tx, refresh)
		if e != nil {
			return e
		}
		value, e = CSRF(refresh, se.ID)
		return e
	})
	return
}

type Mutation struct {
	Action, Access, Refresh, Origin, CSRF, RequestID string
	ClassID                                          func() (string, error)
	ValidateBody                                     func() error
}

// Mutate authenticates inside the same locked transaction as its write. Body
// parsing is deferred until credentials, binding, Origin and CSRF all pass.
func (s *Service) Mutate(ctx context.Context, in Mutation) (out Issued, err error) {
	err = s.transaction(ctx, func(tx Tx) error {
		u, se, e := s.refresh(tx, in.Refresh)
		if e != nil {
			return e
		}
		if in.Action != "refresh" {
			_, other, _, e := s.access(tx, in.Access)
			if e != nil {
				return e
			}
			if other.ID != se.ID {
				return ErrForbidden
			}
		}
		csrf, e := CSRF(in.Refresh, se.ID)
		if e != nil {
			return e
		}
		if in.Origin != s.origin || subtle.ConstantTimeCompare([]byte(csrf), []byte(in.CSRF)) != 1 {
			return ErrForbidden
		}
		if in.ValidateBody != nil {
			if e = in.ValidateBody(); e != nil {
				return e
			}
		}
		switch in.Action {
		case "refresh":
			out, e = s.issue(tx, u, &se, false)
		case "logout":
			se.Revoked = true
			e = tx.SaveSession(se)
		case "switch-class":
			if in.ClassID == nil {
				return ErrInvalid
			}
			id, parseErr := in.ClassID()
			if parseErr != nil {
				return parseErr
			}
			n, parseErr := strconv.ParseUint(id, 10, 64)
			if parseErr != nil || n == 0 || strconv.FormatUint(n, 10) != id {
				return ErrInvalid
			}
			classes, queryErr := tx.Classes(u.ID)
			if queryErr != nil {
				return queryErr
			}
			allowed := false
			for _, cid := range classes {
				if cid == id {
					allowed = true
				}
			}
			if !allowed {
				return ErrForbidden
			}
			se.ClassID = id
			se.Version++
			out, e = s.issue(tx, u, &se, false)
		default:
			return ErrForbidden
		}
		if e != nil {
			return e
		}
		return tx.Audit(Audit{in.Action, "allowed", u.ID, se.ID, in.RequestID, s.now().UTC()})
	})
	if err != nil {
		return Issued{}, err
	}
	return
}

// These operations are for trusted internal administrators. No HTTP routes are exposed.
func (s *Service) ChangePassword(ctx context.Context, userID, password, rid string) error {
	hash, e := HashPassword(password)
	if e != nil {
		return e
	}
	return s.revoke(ctx, userID, rid, func(u *User) { u.PasswordHash = hash }, "password-change")
}
func (s *Service) Disable(ctx context.Context, userID, rid string) error {
	return s.revoke(ctx, userID, rid, func(u *User) { u.Enabled = false }, "disable")
}
func (s *Service) Revoke(ctx context.Context, userID, rid string) error {
	return s.revoke(ctx, userID, rid, func(u *User) {}, "revoke")
}
func (s *Service) revoke(ctx context.Context, userID, rid string, update func(*User), action string) error {
	return s.transaction(ctx, func(tx Tx) error {
		u, e := tx.UserByID(userID)
		if e != nil {
			return e
		}
		update(&u)
		u.SecurityVersion++
		if e = tx.SaveUser(u); e != nil {
			return e
		}
		if e = tx.RevokeUser(u.ID); e != nil {
			return e
		}
		return tx.Audit(Audit{action, "allowed", u.ID, "", rid, s.now().UTC()})
	})
}
