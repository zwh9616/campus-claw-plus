// Package assignments owns AT resource, input and mutation rules without HTTP/SQL dependencies.
package assignments

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
)

const Timestamp = "2006-01-02T15:04:05.000Z"

var (
	ErrIdempotencyConflict = errors.New("IDEMPOTENCY_CONFLICT")
	ErrRetryExhausted      = errors.New("RETRY_EXHAUSTED")
	ErrTaskTerminal        = errors.New("TASK_TERMINAL")
)

type RateError struct{ Seconds int }

func (*RateError) Error() string { return "RATE_LIMITED" }

type Assignment struct {
	ID          string `json:"id"`
	ClassID     string `json:"class_id"`
	TeacherID   string `json:"teacher_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Deadline    string `json:"deadline"`
	Version     uint64 `json:"version"`
	CreatedAt   string `json:"created_at"`
}
type Submission struct {
	ID                string `json:"id"`
	AssignmentID      string `json:"assignment_id"`
	AssignmentVersion uint64 `json:"assignment_version"`
	StudentID         string `json:"student_id"`
	Answer            string `json:"answer"`
	TaskID            string `json:"task_id"`
	CreatedAt         string `json:"created_at"`
}
type Accepted struct {
	SubmissionID string `json:"submission_id"`
	TaskID       string `json:"task_id"`
	Status       string `json:"status"`
}
type TaskError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
type Task struct {
	ID              string     `json:"task_id"`
	SubmissionID    string     `json:"submission_id"`
	Status          string     `json:"status"`
	Attempt         int        `json:"attempt"`
	Epoch           uint64     `json:"execution_epoch"`
	Version         uint64     `json:"version"`
	CancelRequested bool       `json:"cancel_requested"`
	CreatedAt       string     `json:"created_at"`
	UpdatedAt       string     `json:"updated_at"`
	Error           *TaskError `json:"error"`
}
type Page[T any] struct {
	Items    []T   `json:"items"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
	Total    int64 `json:"total"`
}
type CreateInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Deadline    string `json:"deadline"`
}

// Version retains positive integral JSON outside uint64 as a mismatch token.
// Such a number cannot match a persisted BIGINT; do not expand huge exponents.
type Version struct {
	Value uint64
	Large bool
}

func (v Version) Matches(n uint64) bool { return !v.Large && v.Value == n }

type SubmitInput struct {
	Answer  string
	Version Version
}
type Permit func() error

type Repository interface {
	CreateAssignment(context.Context, identity.Principal, CreateInput, Permit) (Assignment, error)
	ListAssignments(context.Context, identity.Principal, int, int) (Page[Assignment], error)
	GetAssignment(context.Context, identity.Principal, string) (Assignment, error)
	SubmitAssignment(context.Context, identity.Principal, string, string, SubmitInput, Permit) (Accepted, error)
	ListSubmissions(context.Context, identity.Principal, string, int, int) (Page[Submission], error)
	GetSubmission(context.Context, identity.Principal, string) (Submission, error)
	GetTask(context.Context, identity.Principal, string) (Task, error)
	ChangeTask(context.Context, identity.Principal, string, string, Version, Permit) (Task, error)
}
type Service struct {
	Repo    Repository
	Limiter *Limiter
}

func Readable(p identity.Principal) error {
	if p.UserID == "" || p.SessionID == "" || p.ClassID == "" {
		return identity.ErrUnauthenticated
	}
	if p.Role != "teacher" && p.Role != "student" {
		return identity.ErrForbidden
	}
	return nil
}
func Action(p identity.Principal, role string) error {
	if e := Readable(p); e != nil {
		return e
	}
	if p.Role != role {
		return identity.ErrForbidden
	}
	return nil
}
func Text(s string, limit int) bool {
	return utf8.ValidString(s) && utf8.RuneCountInString(s) >= 1 && utf8.RuneCountInString(s) <= limit
}
func ValidID(s string) bool {
	if s == "" || s[0] == '0' {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	n, e := strconv.ParseUint(s, 10, 64)
	return e == nil && n > 0 && n <= 9223372036854775807
}
func ValidKey(s string) bool {
	if len(s) < 16 || len(s) > 64 {
		return false
	}
	for _, r := range s {
		if r < 32 || r > 126 {
			return false
		}
	}
	return true
}
func ValidCreate(in CreateInput) bool {
	at, e := time.Parse(Timestamp, in.Deadline)
	return Text(in.Title, 200) && strings.TrimSpace(in.Title) != "" && Text(in.Description, 20000) && strings.TrimSpace(in.Description) != "" && e == nil && at.Format(Timestamp) == in.Deadline
}
func (s *Service) permit(p identity.Principal) Permit {
	return func() error {
		if s.Limiter == nil {
			return identity.ErrUnavailable
		}
		ok, retry := s.Limiter.Allow(p.UserID)
		if !ok {
			return &RateError{retry}
		}
		return nil
	}
}
func (s *Service) Create(ctx context.Context, p identity.Principal, in CreateInput) (Assignment, error) {
	if e := Action(p, "teacher"); e != nil {
		return Assignment{}, e
	}
	if !ValidCreate(in) {
		return Assignment{}, identity.ErrInvalid
	}
	return s.Repo.CreateAssignment(ctx, p, in, s.permit(p))
}
func (s *Service) Submit(ctx context.Context, p identity.Principal, id, key string, in SubmitInput) (Accepted, error) {
	if e := Action(p, "student"); e != nil {
		return Accepted{}, e
	}
	if !ValidID(id) || !ValidKey(key) || !Text(in.Answer, 20000) || (!in.Version.Large && in.Version.Value == 0) {
		return Accepted{}, identity.ErrInvalid
	}
	return s.Repo.SubmitAssignment(ctx, p, id, key, in, s.permit(p))
}
func (s *Service) Change(ctx context.Context, p identity.Principal, id, action string, v Version) (Task, error) {
	if e := Action(p, "student"); e != nil {
		return Task{}, e
	}
	if !ValidID(id) || (action != "retry" && action != "cancel") || (!v.Large && v.Value == 0) {
		return Task{}, identity.ErrInvalid
	}
	return s.Repo.ChangeTask(ctx, p, id, action, v, s.permit(p))
}

// Digest only runs for versions representable in the database. Larger integral
// inputs already differ from every possible committed snapshot/current version.
func Digest(in SubmitInput) [32]byte {
	b, _ := json.Marshal(struct {
		Answer  string `json:"answer"`
		Version uint64 `json:"assignment_version"`
	}{in.Answer, in.Version.Value})
	return sha256.Sum256(b)
}

// PositiveVersion accepts mathematically integral JSON, including 1.0/1e0.
// Time/memory stay bounded by the wire input, even for 1e999999999999.
func PositiveVersion(raw []byte) (Version, error) {
	bad := func() (Version, error) { return Version{}, identity.ErrInvalid }
	s := strings.TrimSpace(string(raw))
	if len(s) == 0 || s[0] < '0' || s[0] > '9' || !json.Valid([]byte(s)) {
		return bad()
	}
	mantissa, exponent := s, 0
	if i := strings.IndexAny(s, "eE"); i >= 0 {
		mantissa = s[:i]
		part := s[i+1:]
		sign := 1
		if part[0] == '-' {
			sign = -1
			part = part[1:]
		} else if part[0] == '+' {
			part = part[1:]
		}
		for _, c := range part {
			if exponent <= 100000 {
				exponent = exponent*10 + int(c-'0')
			}
		}
		exponent *= sign
	}
	digits := mantissa
	fraction := 0
	if i := strings.IndexByte(mantissa, '.'); i >= 0 {
		fraction = len(mantissa) - i - 1
		digits = mantissa[:i] + mantissa[i+1:]
	}
	digits = strings.TrimLeft(digits, "0")
	if digits == "" {
		return bad()
	}
	scale := exponent - fraction
	if scale < 0 {
		remove := -scale
		trailing := len(digits) - len(strings.TrimRight(digits, "0"))
		if remove > trailing {
			return bad()
		}
		digits = digits[:len(digits)-remove]
		scale = 0
	}
	if len(digits)+scale > 20 {
		return Version{Large: true}, nil
	}
	digits += strings.Repeat("0", scale)
	n, e := strconv.ParseUint(digits, 10, 64)
	if e != nil {
		return Version{Large: true}, nil
	}
	return Version{Value: n}, nil
}

type Limiter struct {
	mu     sync.Mutex
	now    func() time.Time
	minute int64
	counts map[string]int
}

func NewLimiter(now func() time.Time) *Limiter {
	if now == nil {
		now = time.Now
	}
	return &Limiter{now: now, counts: map[string]int{}}
}
func (l *Limiter) Allow(user string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	minute := now.Unix() / 60
	if minute != l.minute {
		l.minute = minute
		clear(l.counts)
	}
	retry := max(1, 60-int(now.Unix()%60))
	if l.counts[user] >= 12 {
		return false, retry
	}
	l.counts[user]++
	return true, 0
}
