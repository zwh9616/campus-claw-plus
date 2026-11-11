package materials

import (
	"context"
	"errors"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"strings"
	"sync"
	"testing"
	"time"
)

type writeProbe struct {
	Repository
	writes int
}

func (p *writeProbe) CreateMaterial(_ context.Context, _ identity.Principal, _ string, _ Upload) (Material, bool, error) {
	p.writes++
	return Material{ID: "1"}, false, nil
}
func TestMRStudentWriteHasNoSideEffects(t *testing.T) {
	repo := &writeProbe{}
	s := &Service{Repo: repo}
	u, _ := PrepareUpload("title", "f.txt", []byte("body"))
	p := identity.Principal{UserID: "1", SessionID: "s", ClassID: "1", Role: "student"}
	if _, _, e := s.Create(context.Background(), p, "allowed_key_0001", u); !errors.Is(e, identity.ErrForbidden) || repo.writes != 0 {
		t.Fatal("MR-SC-02 student reached persistent write")
	}
	p.Role = "teacher"
	if _, _, e := s.Create(context.Background(), p, "allowed_key_0001", u); e != nil || repo.writes != 1 {
		t.Fatal("valid teacher rejected")
	}
}

func TestMRTextAndOriginalBytes(t *testing.T) {
	raw := []byte("\xef\xbb\xbf中文😀\r\n100%_\r结尾")
	u, err := PrepareUpload("  标题😀  ", "LESSON.TXT", raw)
	if err != nil || u.Title != "标题😀" || u.Body != "中文😀\n100%_\n结尾" || string(u.Raw) != string(raw) {
		t.Fatal("MR-SC-01/04 canonical text/raw bytes")
	}
	other, _ := PrepareUpload("标题😀", "other.txt", raw)
	if u.Digest != other.Digest {
		t.Fatal("filename must not change idempotent payload")
	}
	changed, _ := PrepareUpload("标题😀", "other.txt", []byte(u.Body))
	if u.Digest == changed.Digest {
		t.Fatal("raw-byte changes must conflict even with identical normalized text")
	}
	for _, body := range [][]byte{nil, {0xff}, {0}, []byte("\ufeff"), []byte("\ufeff \t\r\n"), []byte("text\u0085"), []byte("text\x7f")} {
		if _, e := PrepareUpload("title", "file.txt", body); e == nil {
			t.Fatal("invalid body accepted")
		}
	}
	for _, title := range []string{"", " \t", "标题\n正文", strings.Repeat("界", 201), string([]byte{0xff})} {
		if _, e := PrepareUpload(title, "f.txt", []byte("ok")); e == nil {
			t.Fatal("invalid title accepted")
		}
	}
	if _, e := PrepareUpload("title", "file.pdf", []byte("ok")); e == nil {
		t.Fatal("format accepted")
	}
	if _, e := PrepareUpload("title", "file.txt", []byte(strings.Repeat("x", MaxFile))); e != nil {
		t.Fatal("inclusive maximum rejected")
	}
	if _, e := PrepareUpload("title", "file.txt", []byte(strings.Repeat("x", MaxFile+1))); e != ErrTooLarge {
		t.Fatal("oversize accepted")
	}
}
func TestMRChunksAndCitationIntegrity(t *testing.T) {
	for _, n := range []int{1, 1999, 2000, 2001, 3800, 3801, 6000} {
		body := strings.Repeat("😀", n)
		chunks := Chunks(body)
		for i, c := range chunks {
			if c.Ordinal != i || c.Start != 1800*i || c.End-c.Start > 2000 || c.Quote != string([]rune(body)[c.Start:c.End]) {
				t.Fatal("MR-SC-09 codepoint chunk")
			}
		}
		if chunks[len(chunks)-1].End != n || len(chunks) > 1 && chunks[len(chunks)-2].End >= n {
			t.Fatal("redundant final chunk")
		}
	}
	doc := Document{Material: Material{ID: "1", Title: "题", Version: 1, IndexStatus: "ready"}, Body: "中文😀"}
	c := Citation{"1", "2", 1, "题", 0, 0, 3, "中文😀", "/api/v1/materials/1"}
	if !CheckCitation(c, doc) {
		t.Fatal("valid citation")
	}
	c.CharEnd = 6
	if CheckCitation(c, doc) {
		t.Fatal("byte offset treated as codepoint")
	}
	c.CharEnd = 3
	c.Quote = "伪造"
	if CheckCitation(c, doc) {
		t.Fatal("corrupt index accepted")
	}
}
func TestMRIdentifiersAndUserRateLimit(t *testing.T) {
	for _, id := range []string{"0", "01", "-1", "9223372036854775808", "１", "1 ", ""} {
		if ValidID(id) {
			t.Fatal("invalid id")
		}
	}
	if !ValidID("9007199254740993") || !ValidID("9223372036854775807") {
		t.Fatal("large string ID lost")
	}
	for _, key := range []string{"short", strings.Repeat("a", 65), strings.Repeat("界", 16), "abcdefghijklmn!x"} {
		if ValidKey(key) {
			t.Fatal("invalid key")
		}
	}
	now := time.Unix(123*60+5, 0)
	l := NewLimiter(func() time.Time { return now })
	var wg sync.WaitGroup
	var mu sync.Mutex
	accepted := 0
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if ok, _ := l.Allow("same-user"); ok {
				mu.Lock()
				accepted++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if accepted != 12 {
		t.Fatal("MR-SC-06 concurrent quota", accepted)
	}
	if ok, retry := l.Allow("same-user"); ok || retry != 55 {
		t.Fatal("window retry")
	}
	if ok, _ := l.Allow("other-user"); !ok {
		t.Fatal("subject isolation")
	}
	now = now.Add(time.Minute)
	if ok, _ := l.Allow("same-user"); !ok {
		t.Fatal("next window")
	}
}
