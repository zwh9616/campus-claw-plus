// Package materials owns MR-01..04 text, authorization and indexing rules.
package materials

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
)

const MaxFile = 262144
const MaxRequest = 278528

var ErrTooLarge = errors.New("PAYLOAD_TOO_LARGE")

type Material struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Version     int    `json:"version"`
	IndexStatus string `json:"index_status"`
	SizeBytes   int    `json:"size_bytes"`
	CreatedAt   string `json:"created_at"`
}
type Document struct {
	Material Material `json:"material"`
	Body     string   `json:"body"`
	Raw      []byte   `json:"-"`
}
type Page struct {
	Items    []Material `json:"items"`
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
	Total    int64      `json:"total"`
}
type Citation struct {
	MaterialID      string `json:"material_id"`
	ChunkID         string `json:"chunk_id"`
	MaterialVersion int    `json:"material_version"`
	Title           string `json:"title"`
	Ordinal         int    `json:"ordinal"`
	CharStart       int    `json:"char_start"`
	CharEnd         int    `json:"char_end"`
	Quote           string `json:"quote"`
	URL             string `json:"url"`
}
type SearchResult struct {
	Items []Citation `json:"items"`
	Mode  string     `json:"mode"`
}
type Upload struct {
	Title, Body, Digest string
	Raw                 []byte
}
type Chunk struct {
	Ordinal, Start, End int
	Quote               string
}

type Repository interface {
	ListMaterials(context.Context, identity.Principal, int, int) (Page, error)
	GetMaterial(context.Context, identity.Principal, string) (Document, error)
	CreateMaterial(context.Context, identity.Principal, string, Upload) (Material, bool, error)
	IndexMaterial(context.Context, identity.Principal, string) (Material, error)
	SearchMaterials(context.Context, identity.Principal, string, int) (SearchResult, error)
}
type Service struct{ Repo Repository }

func Readable(p identity.Principal) error {
	if p.UserID == "" || p.SessionID == "" || p.ClassID == "" {
		return identity.ErrUnauthenticated
	}
	if p.Role != "teacher" && p.Role != "student" {
		return identity.ErrForbidden
	}
	return nil
}
func Writable(p identity.Principal) error {
	if err := Readable(p); err != nil {
		return err
	}
	if p.Role != "teacher" {
		return identity.ErrForbidden
	}
	return nil
}
func ValidID(id string) bool {
	if len(id) == 0 || id[0] == '0' {
		return false
	}
	for _, r := range id {
		if r < '0' || r > '9' {
			return false
		}
	}
	n, err := strconv.ParseUint(id, 10, 64)
	return err == nil && n > 0 && n <= 9223372036854775807
}
func ValidKey(key string) bool {
	if len(key) < 16 || len(key) > 64 {
		return false
	}
	for _, r := range key {
		if !(r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '_' || r == '-') {
			return false
		}
	}
	return true
}
func Text(value string, min, max int) bool {
	if !utf8.ValidString(value) {
		return false
	}
	n := utf8.RuneCountInString(value)
	if n < min || n > max {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}
func PrepareUpload(title, filename string, raw []byte) (Upload, error) {
	title = strings.TrimSpace(title)
	if len(raw) > MaxFile {
		return Upload{}, ErrTooLarge
	}
	if !Text(title, 1, 200) || !strings.HasSuffix(strings.ToLower(filename), ".txt") || len(raw) == 0 || !utf8.Valid(raw) {
		return Upload{}, identity.ErrInvalid
	}
	for _, r := range string(raw) {
		if unicode.IsControl(r) && r != '\t' && r != '\r' && r != '\n' {
			return Upload{}, identity.ErrInvalid
		}
	}
	body := strings.TrimPrefix(string(raw), "\uFEFF")
	body = strings.ReplaceAll(strings.ReplaceAll(body, "\r\n", "\n"), "\r", "\n")
	if strings.TrimSpace(body) == "" {
		return Upload{}, identity.ErrInvalid
	}
	h := sha256.New()
	for _, value := range [][]byte{[]byte(title), raw} {
		var size [8]byte
		binary.BigEndian.PutUint64(size[:], uint64(len(value)))
		h.Write(size[:])
		h.Write(value)
	}
	return Upload{title, body, hex.EncodeToString(h.Sum(nil)), append([]byte(nil), raw...)}, nil
}
func Chunks(body string) []Chunk {
	runes := []rune(body)
	var out []Chunk
	for start := 0; start < len(runes); start += 1800 {
		end := min(start+2000, len(runes))
		out = append(out, Chunk{len(out), start, end, string(runes[start:end])})
		if end == len(runes) {
			break
		}
	}
	return out
}
func CheckCitation(c Citation, doc Document) bool {
	runes := []rune(doc.Body)
	if !ValidID(c.ChunkID) || c.MaterialID != doc.Material.ID || c.MaterialVersion != 1 || c.MaterialVersion != doc.Material.Version || c.Title != doc.Material.Title || c.URL != "/api/v1/materials/"+c.MaterialID {
		return false
	}
	chunks := Chunks(doc.Body)
	if c.Ordinal < 0 || c.Ordinal >= len(chunks) || c.CharStart < 0 || c.CharEnd > len(runes) {
		return false
	}
	want := chunks[c.Ordinal]
	return c.CharStart == want.Start && c.CharEnd == want.End && c.Quote == want.Quote
}
func (s *Service) Create(ctx context.Context, p identity.Principal, key string, upload Upload) (Material, bool, error) {
	if err := Writable(p); err != nil {
		return Material{}, false, err
	}
	if !ValidKey(key) {
		return Material{}, false, identity.ErrInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	m, created, err := s.Repo.CreateMaterial(ctx, p, key, upload)
	if err != nil || !created {
		return m, created, err
	}
	m, err = s.Repo.IndexMaterial(ctx, p, m.ID)
	return m, true, err
}

// Limiter is shared by upload/retry and keyed by the trusted user, not class.
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
