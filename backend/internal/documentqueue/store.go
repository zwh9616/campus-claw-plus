// Package documentqueue persists DI-03 jobs independently of assignment Tasks.
// It is not wired into the production server. Callers must supply identities
// from an authorized server session; these methods are not an HTTP boundary.
package documentqueue

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

var (
	ErrInvalid     = errors.New("invalid document input")
	ErrConflict    = errors.New("document state conflict")
	ErrLost        = errors.New("document lease lost")
	ErrUnavailable = errors.New("document storage unavailable")
	ErrTimeout     = errors.New("document storage deadline")
	ErrExhausted   = errors.New("document attempts exhausted")
	keyPattern     = regexp.MustCompile(`^[A-Za-z0-9_-]{16,64}$`)
	ownerPattern   = regexp.MustCompile(`^[0-9a-f]{32}$`)
)

const LeaseDuration = 60 * time.Second

type Store struct {
	DB *sql.DB
	// Hook is nil in production; tests interrupt real transaction boundaries.
	Hook func(string) error
}
type Upload struct {
	UserID, ClassID    uint64
	Key, Title, Format string
	Original           []byte
}
type Accepted struct {
	ID     uint64
	Body   []byte
	Replay bool
}
type Lease struct {
	ID, ClassID, Epoch uint64
	Owner              string
}
type Work struct {
	Lease
	Format   string
	Original []byte
	Digest   [32]byte
}
type Location struct {
	Kind             string
	Unit, Start, End int
}
type Result struct {
	Status, Body, Failure string
	Pages                 *int
	Locations             []Location
}

func storageError(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	if ctx.Err() != nil || errors.Is(err, context.DeadlineExceeded) {
		return ErrTimeout
	}
	return ErrUnavailable
}
func (s *Store) tx(ctx context.Context, fn func(context.Context, *sql.Tx) error) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return storageError(ctx, err)
	}
	defer tx.Rollback()
	if err = fn(ctx, tx); err != nil {
		return err
	}
	// An uncertain commit is never retried automatically. The original key
	// permits a later authorized request to recover the committed snapshot.
	return storageError(ctx, tx.Commit())
}
func (s *Store) hook(stage string) error {
	if s.Hook != nil {
		return s.Hook(stage)
	}
	return nil
}
func now(ctx context.Context, tx *sql.Tx) (time.Time, error) {
	var t time.Time
	err := tx.QueryRowContext(ctx, "SELECT UTC_TIMESTAMP(3)").Scan(&t)
	return t, storageError(ctx, err)
}
func exec(ctx context.Context, tx *sql.Tx, q string, args ...any) error {
	_, err := tx.ExecContext(ctx, q, args...)
	return storageError(ctx, err)
}
func changed(ctx context.Context, tx *sql.Tx, q string, args ...any) error {
	r, e := tx.ExecContext(ctx, q, args...)
	if e != nil {
		return storageError(ctx, e)
	}
	n, e := r.RowsAffected()
	if e != nil {
		return storageError(ctx, e)
	}
	if n != 1 {
		return ErrLost
	}
	return nil
}
func validUpload(u Upload) bool {
	if u.UserID == 0 || u.ClassID == 0 || u.UserID > 1<<63-1 || u.ClassID > 1<<63-1 || !keyPattern.MatchString(u.Key) || !utf8.ValidString(u.Title) || strings.TrimSpace(u.Title) != u.Title || utf8.RuneCountInString(u.Title) < 1 || utf8.RuneCountInString(u.Title) > 200 || len(u.Original) < 1 || len(u.Original) > 10485760 {
		return false
	}
	for _, r := range u.Title {
		if unicode.IsControl(r) {
			return false
		}
	}
	return u.Format == "pdf" || u.Format == "docx"
}
func digest(u Upload) [32]byte {
	h := sha256.New()
	for _, b := range [][]byte{[]byte(u.Format), []byte(u.Title), u.Original} {
		var n [8]byte
		binary.BigEndian.PutUint64(n[:], uint64(len(b)))
		h.Write(n[:])
		h.Write(b)
	}
	var v [32]byte
	copy(v[:], h.Sum(nil))
	return v
}

// Enqueue atomically retains original bytes, a pending job and exact 202 bytes.
// A per-user lock serializes concurrent keys without application-level retries.
// New-upload parser preflight belongs before this transaction in the future
// authorized service; committed replay must be looked up before that preflight.
func (s *Store) Enqueue(ctx context.Context, u Upload) (out Accepted, err error) {
	if !validUpload(u) {
		return out, ErrInvalid
	}
	payload := digest(u)
	original := sha256.Sum256(u.Original)
	err = s.tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		var user uint64
		if e := tx.QueryRowContext(ctx, "SELECT id FROM users WHERE id=? FOR UPDATE", u.UserID).Scan(&user); e != nil {
			return storageError(ctx, e)
		}
		var prior []byte
		e := tx.QueryRowContext(ctx, "SELECT document_id,payload_digest,response_body FROM document_idempotency WHERE user_id=? AND class_id=? AND idempotency_key=?", u.UserID, u.ClassID, []byte(u.Key)).Scan(&out.ID, &prior, &out.Body)
		if e == nil {
			if string(prior) != string(payload[:]) {
				return ErrConflict
			}
			out.Replay = true
			return nil
		}
		if !errors.Is(e, sql.ErrNoRows) {
			return storageError(ctx, e)
		}
		at, e := now(ctx, tx)
		if e != nil {
			return e
		}
		r, e := tx.ExecContext(ctx, "INSERT INTO documents(class_id,created_by,title,format,version,status,original_bytes,original_digest,size_bytes,attempts,created_at,updated_at) VALUES(?,?,?,?,1,'queued',?,?,?,0,?,?)", u.ClassID, u.UserID, u.Title, u.Format, u.Original, original[:], len(u.Original), at, at)
		if e != nil {
			return storageError(ctx, e)
		}
		id, e := r.LastInsertId()
		if e != nil {
			return storageError(ctx, e)
		}
		out.ID = uint64(id)
		if e = s.hook("enqueue-document"); e != nil {
			return e
		}
		if e = exec(ctx, tx, "INSERT INTO document_parse_jobs(document_id,class_id,document_version,delivery_state,available_at,execution_epoch) VALUES(?,?,1,'pending',?,0)", out.ID, u.ClassID, at); e != nil {
			return e
		}
		if e = s.hook("enqueue-job"); e != nil {
			return e
		}
		out.Body, e = json.Marshal(struct {
			ID       string  `json:"id"`
			Title    string  `json:"title"`
			Format   string  `json:"format"`
			Version  int     `json:"version"`
			Status   string  `json:"status"`
			Size     int     `json:"size_bytes"`
			Attempts int     `json:"attempts"`
			Pages    *int    `json:"page_count"`
			Failure  *string `json:"failure_reason"`
			Created  string  `json:"created_at"`
			Updated  string  `json:"updated_at"`
		}{strconv.FormatUint(out.ID, 10), u.Title, u.Format, 1, "queued", len(u.Original), 0, nil, nil, at.UTC().Format(time.RFC3339Nano), at.UTC().Format(time.RFC3339Nano)})
		if e != nil {
			return ErrUnavailable
		}
		if e = exec(ctx, tx, "INSERT INTO document_idempotency VALUES(?,?,?,?,?,1,?)", u.UserID, u.ClassID, []byte(u.Key), payload[:], out.ID, out.Body); e != nil {
			return e
		}
		return s.hook("enqueue-snapshot")
	})
	if err != nil {
		out = Accepted{}
	}
	return
}

// Replay does not contact the parser and is called after fresh authorization.
func (s *Store) Replay(ctx context.Context, u Upload) (out Accepted, found bool, err error) {
	if !validUpload(u) {
		return out, false, ErrInvalid
	}
	d := digest(u)
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var old []byte
	e := s.DB.QueryRowContext(ctx, "SELECT document_id,payload_digest,response_body FROM document_idempotency WHERE user_id=? AND class_id=? AND idempotency_key=?", u.UserID, u.ClassID, []byte(u.Key)).Scan(&out.ID, &old, &out.Body)
	if errors.Is(e, sql.ErrNoRows) {
		return Accepted{}, false, nil
	}
	if e != nil {
		return Accepted{}, false, storageError(ctx, e)
	}
	if string(old) != string(d[:]) {
		return Accepted{}, true, ErrConflict
	}
	out.Replay = true
	return out, true, nil
}

// Ready observes a bounded batch, prioritizing expired work over new uploads.
// Claim rechecks all state after locking; observation grants no authority.
func (s *Store) Ready(ctx context.Context) (ids []uint64, err error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	for _, q := range []string{
		"SELECT j.document_id FROM document_parse_jobs j FORCE INDEX(ix_document_job_lease) JOIN documents d ON d.id=j.document_id WHERE j.delivery_state='leased' AND j.lease_until<=UTC_TIMESTAMP(3) AND d.status='processing' ORDER BY j.lease_until,j.document_id LIMIT ?",
		"SELECT j.document_id FROM document_parse_jobs j FORCE INDEX(ix_document_job_delivery) JOIN documents d ON d.id=j.document_id WHERE j.delivery_state='pending' AND j.available_at<=UTC_TIMESTAMP(3) AND d.status='queued' AND d.attempts<3 ORDER BY j.available_at,j.document_id LIMIT ?",
	} {
		if len(ids) == 20 {
			break
		}
		rows, e := s.DB.QueryContext(ctx, q, 20-len(ids))
		if e != nil {
			return nil, storageError(ctx, e)
		}
		for rows.Next() {
			var id uint64
			if e = rows.Scan(&id); e != nil {
				rows.Close()
				return nil, storageError(ctx, e)
			}
			ids = append(ids, id)
		}
		e = rows.Err()
		rows.Close()
		if e != nil {
			return nil, storageError(ctx, e)
		}
	}
	return
}

type locked struct {
	class                           uint64
	format, status, delivery, owner string
	attempt                         int
	epoch                           uint64
	until                           sql.NullTime
	available                       time.Time
	original, digest                []byte
}

func lock(ctx context.Context, tx *sql.Tx, id uint64) (v locked, err error) {
	err = tx.QueryRowContext(ctx, "SELECT class_id,format,status,attempts,original_bytes,original_digest FROM documents WHERE id=? FOR UPDATE", id).Scan(&v.class, &v.format, &v.status, &v.attempt, &v.original, &v.digest)
	if errors.Is(err, sql.ErrNoRows) {
		return v, ErrLost
	}
	if err != nil {
		return v, storageError(ctx, err)
	}
	var owner sql.NullString
	err = tx.QueryRowContext(ctx, "SELECT delivery_state,worker_owner,execution_epoch,lease_until,available_at FROM document_parse_jobs WHERE document_id=? AND class_id=? AND document_version=1 FOR UPDATE", id, v.class).Scan(&v.delivery, &owner, &v.epoch, &v.until, &v.available)
	v.owner = owner.String
	return v, storageError(ctx, err)
}
func closeJob(ctx context.Context, tx *sql.Tx, id uint64) error {
	return exec(ctx, tx, "UPDATE document_parse_jobs SET delivery_state='closed',worker_owner=NULL,lease_until=NULL WHERE document_id=?", id)
}
func authority(v locked, l Lease, at time.Time) bool {
	return v.class == l.ClassID && v.status == "processing" && v.delivery == "leased" && v.owner == l.Owner && ownerPattern.MatchString(l.Owner) && v.epoch == l.Epoch && v.until.Valid && v.until.Time.After(at)
}
func (s *Store) Claim(ctx context.Context, id uint64, owner string) (out Work, err error) {
	if !ownerPattern.MatchString(owner) {
		return out, ErrInvalid
	}
	exhausted := false
	err = s.tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := lock(ctx, tx, id)
		if e != nil {
			return e
		}
		at, e := now(ctx, tx)
		if e != nil {
			return e
		}
		pending := v.status == "queued" && v.delivery == "pending" && !v.available.After(at)
		expired := v.status == "processing" && v.delivery == "leased" && v.until.Valid && !v.until.Time.After(at)
		if !pending && !expired {
			return ErrLost
		}
		if v.attempt >= 3 {
			if !expired {
				return ErrLost
			}
			if e = exec(ctx, tx, "UPDATE documents SET status='failed',failure_reason='worker_interrupted',updated_at=? WHERE id=?", at, id); e != nil {
				return e
			}
			exhausted = true
			return closeJob(ctx, tx, id)
		}
		if e = exec(ctx, tx, "UPDATE documents SET status='processing',attempts=attempts+1,updated_at=? WHERE id=?", at, id); e != nil {
			return e
		}
		if e = s.hook("claim-document"); e != nil {
			return e
		}
		if e = exec(ctx, tx, "UPDATE document_parse_jobs SET delivery_state='leased',worker_owner=?,execution_epoch=execution_epoch+1,lease_until=? WHERE document_id=?", owner, at.Add(LeaseDuration), id); e != nil {
			return e
		}
		if e = s.hook("claim-job"); e != nil {
			return e
		}
		out = Work{Lease: Lease{id, v.class, v.epoch + 1, owner}, Format: v.format, Original: v.original}
		copy(out.Digest[:], v.digest)
		return nil
	})
	if err == nil && exhausted {
		err = ErrExhausted
	}
	if err != nil {
		out = Work{}
	}
	return
}
func (s *Store) Renew(ctx context.Context, l Lease) error {
	return s.tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := lock(ctx, tx, l.ID)
		if e != nil {
			return e
		}
		at, e := now(ctx, tx)
		if e != nil {
			return e
		}
		if !authority(v, l, at) {
			return ErrLost
		}
		// Same-millisecond heartbeats may set an identical DATETIME(3). MySQL's
		// default affected-row mode reports zero then; check live authority rather
		// than treating that legitimate no-op as lost ownership.
		e = changed(ctx, tx, "UPDATE document_parse_jobs SET lease_until=? WHERE document_id=? AND worker_owner=? AND execution_epoch=? AND delivery_state='leased' AND lease_until>UTC_TIMESTAMP(3)", at.Add(LeaseDuration), l.ID, l.Owner, l.Epoch)
		if errors.Is(e, ErrLost) {
			var n int
			err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM document_parse_jobs WHERE document_id=? AND worker_owner=? AND execution_epoch=? AND delivery_state='leased' AND lease_until>UTC_TIMESTAMP(3)", l.ID, l.Owner, l.Epoch).Scan(&n)
			if err != nil {
				return storageError(ctx, err)
			}
			if n == 1 {
				return nil
			}
		}
		return e
	})
}

// Finish builds quotes exclusively from the validated body and rechecks the
// persistent original digest. A final live-lease CAS shares the transaction
// with every location, chunk, state and delivery mutation.
func (s *Store) Finish(ctx context.Context, w Work, r Result) error {
	if !validResult(w.Format, r) {
		return ErrInvalid
	}
	return s.tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := lock(ctx, tx, w.ID)
		if e != nil {
			return e
		}
		at, e := now(ctx, tx)
		if e != nil {
			return e
		}
		if !authority(v, w.Lease, at) {
			return ErrLost
		}
		d := sha256.Sum256(v.original)
		if v.format != w.Format || d != w.Digest || string(d[:]) != string(v.digest) {
			return ErrUnavailable
		}
		if e = s.hook("finish-locked"); e != nil {
			return e
		}
		text := []rune(r.Body)
		for _, p := range r.Locations {
			if e = exec(ctx, tx, "INSERT INTO document_locations VALUES(?,?,1,?,?,?,?)", w.ID, w.ClassID, p.Unit, p.Kind, p.Start, p.End); e != nil {
				return e
			}
			ordinal := 0
			for start := p.Start; start < p.End; {
				end := start + 2000
				if end > p.End {
					end = p.End
				}
				ordinal++
				if e = exec(ctx, tx, "INSERT INTO document_chunks(document_id,class_id,document_version,unit,ordinal,char_start,char_end,quote) VALUES(?,?,1,?,?,?,?,?)", w.ID, w.ClassID, p.Unit, ordinal, start, end, string(text[start:end])); e != nil {
					return e
				}
				if e = s.hook("finish-chunk"); e != nil {
					return e
				}
				if end == p.End {
					break
				}
				start = end - 200
			}
		}
		var body, failure any
		if r.Status == "ready" {
			body = r.Body
		}
		if r.Status == "failed" {
			failure = r.Failure
		}
		if e = exec(ctx, tx, "UPDATE documents SET status=?,body=?,page_count=?,failure_reason=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?", r.Status, body, r.Pages, failure, w.ID); e != nil {
			return e
		}
		if e = s.hook("finish-document"); e != nil {
			return e
		}
		if e = changed(ctx, tx, "UPDATE document_parse_jobs SET delivery_state='closed',worker_owner=NULL,lease_until=NULL WHERE document_id=? AND class_id=? AND document_version=1 AND worker_owner=? AND execution_epoch=? AND delivery_state='leased' AND lease_until>UTC_TIMESTAMP(3)", w.ID, w.ClassID, w.Owner, w.Epoch); e != nil {
			return e
		}
		return s.hook("finish-job")
	})
}
func (s *Store) Retry(ctx context.Context, id, class uint64) error {
	return s.tx(ctx, func(ctx context.Context, tx *sql.Tx) error {
		v, e := lock(ctx, tx, id)
		if e != nil {
			return e
		}
		if v.class != class {
			return ErrLost
		}
		var reason sql.NullString
		if e = tx.QueryRowContext(ctx, "SELECT failure_reason FROM documents WHERE id=?", id).Scan(&reason); e != nil {
			return storageError(ctx, e)
		}
		if v.status != "failed" || v.delivery != "closed" || v.attempt >= 3 || (reason.String != "parse_timeout" && reason.String != "worker_interrupted" && reason.String != "internal_failure") {
			return ErrConflict
		}
		if e = exec(ctx, tx, "UPDATE documents SET status='queued',failure_reason=NULL,updated_at=UTC_TIMESTAMP(3) WHERE id=?", id); e != nil {
			return e
		}
		if e = s.hook("retry-document"); e != nil {
			return e
		}
		return exec(ctx, tx, "UPDATE document_parse_jobs SET delivery_state='pending',worker_owner=NULL,lease_until=NULL,available_at=UTC_TIMESTAMP(3) WHERE document_id=?", id)
	})
}
func NewOwner() (string, error) {
	var b [16]byte
	if _, e := rand.Read(b[:]); e != nil {
		return "", ErrUnavailable
	}
	return hex.EncodeToString(b[:]), nil
}

func validResult(format string, r Result) bool {
	if format != "pdf" && format != "docx" {
		return false
	}
	if r.Status == "failed" {
		switch r.Failure {
		case "corrupt", "encrypted", "unsupported_content", "resource_limit", "parse_timeout", "worker_interrupted", "internal_failure":
			return r.Body == "" && len(r.Locations) == 0 && r.Pages == nil
		}
		return false
	}
	pages := r.Pages != nil && *r.Pages >= 1 && *r.Pages <= 200
	if r.Status == "needs_ocr" {
		return format == "pdf" && pages && r.Body == "" && len(r.Locations) == 0 && r.Failure == ""
	}
	if r.Status != "ready" || r.Failure != "" || !utf8.ValidString(r.Body) || len(r.Body) < 1 || len(r.Body) > 2097152 || len(r.Locations) == 0 || len(r.Locations) > 20000 || (format == "pdf" && !pages) || (format == "docx" && r.Pages != nil) {
		return false
	}
	for _, c := range r.Body {
		if unicode.IsControl(c) && c != '\n' && c != '\t' {
			return false
		}
	}
	text := []rune(r.Body)
	end, unit := 0, 0
	for i, p := range r.Locations {
		start := end
		if i > 0 {
			if end+2 > len(text) || string(text[end:end+2]) != "\n\n" {
				return false
			}
			start += 2
		}
		if p.Unit <= unit || p.Unit > 20000 || p.Start != start || p.End <= p.Start || p.End > len(text) {
			return false
		}
		if format == "pdf" && (p.Kind != "pdf_page" || p.Unit > *r.Pages) {
			return false
		}
		if format == "docx" && p.Kind != "docx_paragraph" && p.Kind != "docx_table_cell" {
			return false
		}
		if strings.TrimSpace(string(text[p.Start:p.End])) == "" {
			return false
		}
		end = p.End
		unit = p.Unit
	}
	return end == len(text)
}
