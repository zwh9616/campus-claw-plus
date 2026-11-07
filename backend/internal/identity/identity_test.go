package identity

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestIDFPasswordAndCSRF(t *testing.T) {
	for _, tt := range []struct {
		n  int
		ok bool
	}{{0, false}, {1, true}, {64, true}, {65, false}} {
		if TextLength(strings.Repeat("界", tt.n), 1, 64) != tt.ok {
			t.Fatal("username codepoint bound")
		}
	}
	for _, tt := range []struct {
		n  int
		ok bool
	}{{0, false}, {1, true}, {128, true}, {129, false}} {
		if TextLength(strings.Repeat("界", tt.n), 1, 128) != tt.ok {
			t.Fatal("login password bound")
		}
	}
	h, e := HashPassword("test-only-password")
	if e != nil || !VerifyPassword(h, "test-only-password") || VerifyPassword(h, "wrong") {
		t.Fatal("password verification")
	}
	h2, _ := HashPassword("test-only-password")
	if h == h2 {
		t.Fatal("salt reused")
	}
	if VerifyPassword("$argon2id$v=19$m=999999999,t=2,p=1$invalid", "x") {
		t.Fatal("unbounded parameters")
	}
	r, _ := token()
	sid, _ := sessionID()
	a, _ := CSRF(r, sid)
	b, _ := CSRF(r, sid)
	r2, _ := token()
	c, _ := CSRF(r2, sid)
	if a != b || a == c || len(a) != 43 {
		t.Fatal("CSRF derivation")
	}
	for _, bad := range []string{"", r + "=", "random"} {
		if _, e := Digest(bad); !errors.Is(e, ErrUnauthenticated) {
			t.Fatal("invalid credential accepted")
		}
	}
}
func TestIDFAuthorization(t *testing.T) {
	p := Principal{UserID: "1", Role: "student", ClassID: "1", SessionID: "session"}
	tests := []struct {
		name     string
		action   Action
		resource Resource
		want     error
	}{
		{"own", ReadPersonal, Resource{true, "1", "1"}, nil}, {"same-class-other", ReadPersonal, Resource{true, "1", "2"}, ErrNotFound},
		{"cross-class", ReadClass, Resource{true, "2", "1"}, ErrNotFound}, {"missing", ReadClass, Resource{}, ErrNotFound},
		{"teacher-only", Teach, Resource{true, "1", "1"}, ErrForbidden}, {"unknown", Action("unknown"), Resource{true, "1", "1"}, ErrForbidden}}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if e := Authorize(p, tt.action, tt.resource); !errors.Is(e, tt.want) {
				t.Fatalf("want %v got %v", tt.want, e)
			}
		})
	}
	p.Role = "teacher"
	if Authorize(p, Teach, Resource{true, "1", "2"}) != nil {
		t.Fatal("teacher rejected")
	}
}
func TestIDFLimiterExactWindowAndAtomicity(t *testing.T) {
	now := time.Unix(1000, 0)
	l := NewLimiter(func() time.Time { return now })
	for i := 0; i < 10; i++ {
		if ok, _ := l.Allow("ip", "user"); !ok {
			t.Fatal("early refusal")
		}
	}
	if ok, r := l.Allow("ip", "user"); ok || r != 60 {
		t.Fatal("11th request")
	}
	now = now.Add(time.Minute)
	if ok, _ := l.Allow("ip", "user"); !ok {
		t.Fatal("exact boundary")
	}
	l = NewLimiter(func() time.Time { return now })
	l.buckets[l.keyFor("source", "ip")] = make([]time.Time, 10)
	l.buckets[l.keyFor("username", "user")] = make([]time.Time, 10)
	for i := 0; i < 10; i++ {
		l.buckets[l.keyFor("source", "ip")][i] = now.Add(-58 * time.Second)
		l.buckets[l.keyFor("username", "user")][i] = now.Add(-40 * time.Second)
	}
	if ok, r := l.Allow("ip", "user"); ok || r != 20 {
		t.Fatal("maximum wait")
	}
	l = NewLimiter(func() time.Time { return now })
	for i := 0; i < 4095; i++ {
		l.buckets[l.keyFor("fixture", fmt.Sprint(i))] = []time.Time{now}
	}
	if ok, _ := l.Allow("new-ip", "new-user"); ok || len(l.buckets) != 4095 {
		t.Fatal("partial bucket allocation")
	}
	delete(l.buckets, l.keyFor("fixture", "0"))
	if ok, _ := l.Allow("new-ip", "new-user"); !ok || len(l.buckets) != 4096 {
		t.Fatal("capacity recovery")
	}
}
func TestIDFLimiterConcurrent(t *testing.T) {
	l := NewLimiter(nil)
	var wg sync.WaitGroup
	var mu sync.Mutex
	success := 0
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if ok, _ := l.Allow("ip", "user"); ok {
				mu.Lock()
				success++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if success != 10 {
		t.Fatalf("winners %d", success)
	}
}
