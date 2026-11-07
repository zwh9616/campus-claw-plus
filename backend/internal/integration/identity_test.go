//go:build integration

package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/httpserver"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func database(t *testing.T, n int) (*sql.DB, *sql.DB, string) {
	t.Helper()
	name := fmt.Sprintf("idf_test_%d", n)
	ca := os.Getenv("MYSQL_CA_FILE")
	app := strings.Replace(os.Getenv("MYSQL_DSN"), "/idf_test_0?", "/"+name+"?", 1)
	offline := strings.Replace(os.Getenv("MYSQL_MIGRATION_DSN"), "/idf_test_0?", "/"+name+"?", 1)
	a, e := mysqlstore.Open(app, ca, false)
	if e != nil {
		t.Fatal("application config")
	}
	d, e := mysqlstore.Open(offline, ca, true)
	if e != nil {
		t.Fatal("offline config")
	}
	t.Cleanup(func() { a.Close(); d.Close() })
	deadline := time.Now().Add(90 * time.Second)
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		e = d.PingContext(ctx)
		cancel()
		if e == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("trusted TLS MySQL unavailable")
		}
		time.Sleep(time.Second)
	}
	return a, d, name
}
func seed(t *testing.T) mysqlstore.Seed {
	t.Helper()
	s, e := mysqlstore.ReadSeed(strings.NewReader(`{"classes":[{"key":"class-a","name":"A"},{"key":"class-b","name":"B"}],"users":[{"username":"teacher-a","password":"test-only-teacher-a","role":"teacher","class_keys":["class-a","class-b"]},{"username":"teacher-b","password":"test-only-teacher-b","role":"teacher","class_keys":["class-b"]},{"username":"student-a","password":"test-only-student-a","role":"student","class_keys":["class-a"]},{"username":"student-b","password":"test-only-student-b","role":"student","class_keys":["class-b"]},{"username":"student-a2","password":"test-only-student-a2","role":"student","class_keys":["class-a"]}]}`))
	if e != nil {
		t.Fatal(e)
	}
	return s
}
func count(t *testing.T, db *sql.DB, table string) int {
	t.Helper()
	var n int
	if e := db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&n); e != nil {
		t.Fatal("count failed")
	}
	return n
}
func TestIDFRealMigrationsAndSessions(t *testing.T) {
	ctx := context.Background()
	app, offline, name := database(t, 0)
	ex := migrations.Executor{DB: offline, Database: name}
	if e := ex.Up(ctx, 3); e != nil {
		t.Fatal("migration", e)
	}
	var version string
	offline.QueryRow("SELECT VERSION()").Scan(&version)
	if !strings.HasPrefix(version, "8.4.13") {
		t.Fatal("unexpected MySQL version")
	}
	t.Log("MySQL version", version)
	store := &mysqlstore.Store{DB: app}
	admin := &mysqlstore.Store{DB: offline}
	input := seed(t)
	if e := admin.Initialize(ctx, input, nil); e != nil {
		t.Fatal(e)
	}
	t.Run("SC14-15-repeat-concurrent-and-rollback", func(t *testing.T) {
		var original string
		offline.QueryRow("SELECT password_hash FROM users WHERE username='teacher-a'").Scan(&original)
		input.Users[0].Password = "different-test-password"
		var wg sync.WaitGroup
		errs := make(chan error, 2)
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() { defer wg.Done(); errs <- admin.Initialize(ctx, input, nil) }()
		}
		wg.Wait()
		close(errs)
		for e := range errs {
			if e != nil {
				t.Fatal(e)
			}
		}
		var after string
		offline.QueryRow("SELECT password_hash FROM users WHERE username='teacher-a'").Scan(&after)
		if original != after || count(t, app, "users") != 5 || count(t, app, "classes") != 2 || count(t, app, "class_memberships") != 6 {
			t.Fatal("initialization not idempotent")
		}
		extra := seed(t)
		extra.Users = []mysqlstore.SeedUser{{Username: "rollback-user", Password: "rollback-test-only", Role: "student", ClassKeys: []string{"class-a"}}}
		if admin.Initialize(ctx, extra, func() error { return errors.New("injected") }) == nil || count(t, app, "users") != 5 {
			t.Fatal("seed failure not rolled back")
		}
		extra.Users[0].Username = "teacher-a"
		if !errors.Is(admin.Initialize(ctx, extra, nil), identity.ErrConflict) {
			t.Fatal("structural conflict")
		}
	})
	now := time.Now().UTC().Truncate(time.Millisecond)
	svc, e := identity.New(store, func() time.Time { return now }, "https://campus.test")
	if e != nil {
		t.Fatal(e)
	}
	login := func(user string) identity.Issued {
		t.Helper()
		out, e := svc.Login(ctx, user, "test-only-"+user, strings.Repeat("a", 32))
		if e != nil {
			t.Fatal("login", user, e)
		}
		return out
	}
	mutate := func(action string, o identity.Issued, class string) (identity.Issued, error) {
		csrf, e := svc.GetCSRF(ctx, o.Refresh)
		if e != nil {
			return identity.Issued{}, e
		}
		return svc.Mutate(ctx, identity.Mutation{Action: action, Access: o.Body.AccessToken, Refresh: o.Refresh, CSRF: csrf, Origin: "https://campus.test", RequestID: strings.Repeat("b", 32), ClassID: func() (string, error) { return class, nil }})
	}
	t.Run("SC01-02-five-identities", func(t *testing.T) {
		for _, u := range []string{"teacher-a", "teacher-b", "student-a", "student-b", "student-a2"} {
			o := login(u)
			p, e := svc.Me(ctx, o.Body.AccessToken)
			if e != nil || p != o.Body.Principal || o.Body.ExpiresIn != 900 {
				t.Fatal("principal mismatch")
			}
			var stored []byte
			if app.QueryRow("SELECT refresh_hash FROM sessions WHERE id=?", p.SessionID).Scan(&stored) != nil {
				t.Fatal("stored refresh digest")
			}
			want, _ := identity.Digest(o.Refresh)
			if !bytes.Equal(stored, want) || bytes.Equal(stored, []byte(o.Refresh)) {
				t.Fatal("refresh persisted incorrectly")
			}
			accessHash, _ := identity.Digest(o.Body.AccessToken)
			var plan string
			if app.QueryRow("EXPLAIN FORMAT=JSON SELECT session_id FROM access_credentials WHERE token_hash=?", accessHash).Scan(&plan) != nil || !strings.Contains(plan, `"key": "PRIMARY"`) {
				t.Fatal("access lookup missing primary index")
			}
		}
		before := count(t, app, "sessions")
		for _, u := range []string{"teacher-a", "nonexistent", "Teacher-a", "teacher-a "} {
			if _, e := svc.Login(ctx, u, "wrong", strings.Repeat("a", 32)); !errors.Is(e, identity.ErrUnauthenticated) {
				t.Fatal("credential rejection")
			}
		}
		if count(t, app, "sessions") != before {
			t.Fatal("failed login wrote session")
		}
	})
	t.Run("SC04-05-concurrent-refresh", func(t *testing.T) {
		o := login("teacher-a")
		csrf, _ := svc.GetCSRF(ctx, o.Refresh)
		again, _ := svc.GetCSRF(ctx, o.Refresh)
		if csrf != again {
			t.Fatal("unstable csrf")
		}
		before := count(t, app, "access_credentials")
		start := make(chan struct{})
		errs := make(chan error, 2)
		outs := make(chan identity.Issued, 2)
		for i := 0; i < 2; i++ {
			go func() {
				<-start
				out, e := svc.Mutate(ctx, identity.Mutation{Action: "refresh", Refresh: o.Refresh, CSRF: csrf, Origin: "https://campus.test", RequestID: strings.Repeat("a", 32)})
				outs <- out
				errs <- e
			}()
		}
		close(start)
		wins, losses := 0, 0
		var winner identity.Issued
		for i := 0; i < 2; i++ {
			e := <-errs
			if e == nil {
				wins++
			} else if errors.Is(e, identity.ErrUnauthenticated) {
				losses++
			} else {
				t.Fatal(e)
			}
			out := <-outs
			if out.Refresh != "" {
				winner = out
			}
		}
		if wins != 1 || losses != 1 || count(t, app, "access_credentials") != before+1 {
			t.Fatal("refresh not atomic")
		}
		if _, e := svc.Me(ctx, o.Body.AccessToken); e != nil {
			t.Fatal("old access wrongly revoked")
		}
		if _, e := svc.GetCSRF(ctx, o.Refresh); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("old refresh survived")
		}
		if _, e := svc.Mutate(ctx, identity.Mutation{Action: "refresh", Refresh: winner.Refresh, CSRF: csrf, Origin: "https://campus.test"}); !errors.Is(e, identity.ErrForbidden) {
			t.Fatal("old CSRF survived")
		}
	})
	t.Run("SC06-07-12-switch-logout-expiry", func(t *testing.T) {
		o := login("teacher-a")
		other := login("teacher-b")
		out, e := mutate("switch-class", o, other.Body.Principal.ClassID)
		if e != nil || out.Body.Principal.SessionVersion != 2 {
			t.Fatal("switch", e)
		}
		if _, e := svc.Me(ctx, o.Body.AccessToken); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("old context survived")
		}
		if _, e := svc.GetCSRF(ctx, o.Refresh); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("old cookie survived")
		}
		if _, e = mutate("logout", out, ""); e != nil {
			t.Fatal(e)
		}
		if _, e = svc.Me(ctx, out.Body.AccessToken); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("logout")
		}
		o = login("student-a")
		now = now.Add(900*time.Second - time.Millisecond)
		if _, e = svc.Me(ctx, o.Body.AccessToken); e != nil {
			t.Fatal("pre expiry")
		}
		now = now.Add(time.Millisecond)
		if _, e = svc.Me(ctx, o.Body.AccessToken); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("exact expiry")
		}
		now = now.Add((604800 - 900) * time.Second)
		if _, e = svc.GetCSRF(ctx, o.Refresh); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("refresh expiry")
		}
	})
	t.Run("SC08-revocation", func(t *testing.T) {
		a := login("student-a")
		b := login("student-a")
		other := login("student-b")
		if e := svc.ChangePassword(ctx, a.Body.Principal.UserID, "updated-test-password", strings.Repeat("a", 32)); e != nil {
			t.Fatal(e)
		}
		for _, o := range []identity.Issued{a, b} {
			if _, e := svc.Me(ctx, o.Body.AccessToken); !errors.Is(e, identity.ErrUnauthenticated) {
				t.Fatal("revoked access")
			}
			if _, e := svc.GetCSRF(ctx, o.Refresh); !errors.Is(e, identity.ErrUnauthenticated) {
				t.Fatal("revoked refresh")
			}
		}
		if _, e := svc.Me(ctx, other.Body.AccessToken); e != nil {
			t.Fatal("unrelated session revoked")
		}
	})
	t.Run("SC09-11-20-real-principal-authorization", func(t *testing.T) {
		a, e := svc.Login(ctx, "student-a", "updated-test-password", strings.Repeat("a", 32))
		if e != nil {
			t.Fatal(e)
		}
		b := login("student-a2")
		cross := login("student-b")
		before := count(t, app, "sessions")
		for _, resource := range []identity.Resource{{Exists: true, ClassID: cross.Body.Principal.ClassID, OwnerUserID: a.Body.Principal.UserID}, {Exists: true, ClassID: b.Body.Principal.ClassID, OwnerUserID: b.Body.Principal.UserID}, {}} {
			if !errors.Is(identity.Authorize(a.Body.Principal, identity.ReadPersonal, resource), identity.ErrNotFound) {
				t.Fatal("isolation failure")
			}
		}
		if count(t, app, "sessions") != before {
			t.Fatal("authorization wrote session")
		}
	})
	t.Run("SC03-13-17-HTTP-HTTPS-order-and-logs", func(t *testing.T) {
		var logs bytes.Buffer
		handler := httpserver.IdentityHandler(slog.New(slog.NewJSONHandler(&logs, nil)), svc, store, config.Identity{Origin: "https://campus.test"}, identity.NewLimiter(nil))
		server := httptest.NewTLSServer(handler)
		defer server.Close()
		client := server.Client()
		request := func(path, body, access, refresh, origin, csrf string) *http.Response {
			t.Helper()
			method := "POST"
			if path == "/api/v1/me" || path == "/api/v1/auth/csrf" || path == "/health" {
				method = "GET"
			}
			r, _ := http.NewRequest(method, server.URL+path, strings.NewReader(body))
			r.Header.Set("Content-Type", "application/json")
			if access != "" {
				r.Header.Set("Authorization", "Bearer "+access)
			}
			if refresh != "" {
				r.AddCookie(&http.Cookie{Name: "campus_refresh", Value: refresh})
			}
			if origin != "" {
				r.Header.Set("Origin", origin)
			}
			if csrf != "" {
				r.Header.Set("X-CSRF-Token", csrf)
			}
			out, e := client.Do(r)
			if e != nil {
				t.Fatal("HTTPS request")
			}
			return out
		}
		resp := request("/api/v1/auth/login", `{"username":"teacher-a","password":"test-only-teacher-a"}`, "", "", "", "")
		var o identity.AuthSession
		json.NewDecoder(resp.Body).Decode(&o)
		resp.Body.Close()
		if resp.StatusCode != 200 || resp.Header.Get("Cache-Control") != "no-store" || len(resp.Header.Get("X-Request-ID")) != 32 {
			t.Fatal("login HTTP")
		}
		cookies := resp.Cookies()
		if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode || cookies[0].Path != "/api/v1/auth" || cookies[0].MaxAge != 604800 {
			t.Fatal("cookie attributes")
		}
		refresh := cookies[0].Value
		csrf, _ := svc.GetCSRF(ctx, refresh)
		other := login("teacher-b")
		before := count(t, app, "access_credentials")
		cases := []struct {
			a, r, o, c string
			want       int
		}{{"", refresh, "bad", "bad", 401}, {o.AccessToken, "bad", "bad", "bad", 401}, {other.Body.AccessToken, refresh, "bad", "bad", 403}, {o.AccessToken, refresh, "bad", csrf, 403}, {o.AccessToken, refresh, "https://campus.test", "bad", 403}}
		for _, c := range cases {
			r := request("/api/v1/auth/logout", "", c.a, c.r, c.o, c.c)
			io.Copy(io.Discard, r.Body)
			r.Body.Close()
			if r.StatusCode != c.want {
				t.Fatalf("priority got %d want %d", r.StatusCode, c.want)
			}
		}
		if count(t, app, "access_credentials") != before {
			t.Fatal("rejection wrote credential")
		}
		for _, bad := range []string{`{"username":"a","username":"b","password":"x"}`, `{"username":1,"password":"x"}`, `{"username":"a","password":"x","role":"teacher"}`} {
			r := request("/api/v1/auth/login", bad, "", "", "", "")
			r.Body.Close()
			if r.StatusCode != 400 {
				t.Fatal("framing accepted")
			}
		}
		r := request("/api/v1/auth/logout", strings.Repeat(" ", 65537), "", "", "", "")
		r.Body.Close()
		if r.StatusCode != 413 {
			t.Fatal("transport bound")
		}
		for _, secret := range []string{o.AccessToken, refresh, csrf, "test-only-teacher-a", os.Getenv("MYSQL_DSN")} {
			if secret != "" && strings.Contains(logs.String(), secret) {
				t.Fatal("secret leaked")
			}
		}
	})
	if e := ex.Check(ctx, 3); e != nil {
		t.Fatal("final schema", e)
	}
}
func TestIDFPartialDDLRecovery(t *testing.T) {
	ctx := context.Background()
	n := 1
	for version, steps := range []int{3, 2, 1} {
		for step := 1; step <= steps; step++ {
			version := version + 1
			step := step
			dbIndex := n
			n++
			t.Run(fmt.Sprintf("SC16-v%d-step%d", version, step), func(t *testing.T) {
				_, db, name := database(t, dbIndex)
				ex := migrations.Executor{DB: db, Database: name}
				if version > 1 {
					if e := ex.Up(ctx, version-1); e != nil {
						t.Fatal(e)
					}
					if e := (&mysqlstore.Store{DB: db}).Initialize(ctx, seed(t), nil); e != nil {
						t.Fatal(e)
					}
				}
				ex.AfterDDL = func(v, s int) error {
					if v == version && s == step {
						return errors.New("injected interruption")
					}
					return nil
				}
				if ex.Up(ctx, version) == nil {
					t.Fatal("failure accepted")
				}
				if ex.Check(ctx, version) == nil {
					t.Fatal("dirty accepted")
				}
				ex.AfterDDL = nil
				if e := ex.Repair(ctx, version); e != nil {
					t.Fatal("repair", e)
				}
				if e := ex.Up(ctx, 3); e != nil {
					t.Fatal("continue upgrade", e)
				}
				if version > 1 && count(t, db, "users") != 5 {
					t.Fatal("existing rows lost")
				}
			})
		}
	}
}
