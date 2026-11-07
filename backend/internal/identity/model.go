// Package identity owns IDF session and authorization rules without HTTP or SQL dependencies.
package identity

import (
	"context"
	"errors"
	"time"
)

var (
	ErrInvalid         = errors.New("VALIDATION_ERROR")
	ErrUnauthenticated = errors.New("UNAUTHENTICATED")
	ErrForbidden       = errors.New("FORBIDDEN")
	ErrNotFound        = errors.New("NOT_FOUND")
	ErrConflict        = errors.New("CONFLICT")
	ErrUnavailable     = errors.New("DEPENDENCY_UNAVAILABLE")
	ErrTimeout         = errors.New("UPSTREAM_TIMEOUT")
)

type Principal struct {
	UserID         string `json:"user_id"`
	Role           string `json:"role"`
	ClassID        string `json:"class_id"`
	SessionID      string `json:"session_id"`
	SessionVersion int64  `json:"session_version"`
	ExpiresAt      string `json:"expires_at"`
}
type AuthSession struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresIn   int       `json:"expires_in"`
	Principal   Principal `json:"principal"`
}
type Issued struct {
	Body    AuthSession
	Refresh string
}
type User struct {
	ID, Username, PasswordHash, Role string
	Enabled                          bool
	SecurityVersion                  int64
}
type Session struct {
	ID, UserID, ClassID      string
	Version, SecurityVersion int64
	RefreshHash              []byte
	RefreshExpires           time.Time
	Revoked                  bool
}
type Access struct {
	Hash      []byte
	SessionID string
	Version   int64
	Expires   time.Time
}
type Audit struct {
	Action, Result, UserID, SessionID, RequestID string
	At                                           time.Time
}

// All methods in Tx are transactional. Implementations lock the user before its
// session, so password revocation and all session writes serialize consistently.
type Tx interface {
	UserByName(string) (User, error)
	UserByID(string) (User, error)
	Classes(string) ([]string, error)
	SessionByRefresh([]byte) (Session, error)
	AccessByHash([]byte) (Access, error)
	SessionByID(string) (Session, error)
	CreateSession(Session) error
	SaveSession(Session) error
	CreateAccess(Access) error
	SaveUser(User) error
	RevokeUser(string) error
	Audit(Audit) error
}
type Repository interface {
	Within(context.Context, func(Tx) error) error
	Ping(context.Context) error
}
type Clock func() time.Time

// Resource must be loaded by a trusted repository, never constructed from a
// client's role/class assertions. Each caller chooses its explicit action rule.
type Resource struct {
	Exists               bool
	ClassID, OwnerUserID string
}
type Action string

const (
	ReadClass    Action = "read-class"
	ReadPersonal Action = "read-personal"
	Teach        Action = "teach"
)

func Authorize(p Principal, action Action, resource Resource) error {
	if p.UserID == "" || p.SessionID == "" {
		return ErrUnauthenticated
	}
	switch action {
	case Teach:
		if p.Role != "teacher" {
			return ErrForbidden
		}
	case ReadClass, ReadPersonal:
	default:
		return ErrForbidden
	}
	if !resource.Exists || resource.ClassID != p.ClassID {
		return ErrNotFound
	}
	if action == ReadPersonal && p.Role == "student" && resource.OwnerUserID != p.UserID {
		return ErrNotFound
	}
	return nil
}
