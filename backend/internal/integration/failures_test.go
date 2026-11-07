//go:build integration

package integration

import (
	"context"
	"errors"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
	"os"
	"strings"
	"testing"
	"time"
)

type faultRepository struct {
	inner identity.Repository
	mode  string
}

func (r faultRepository) Ping(ctx context.Context) error { return r.inner.Ping(ctx) }
func (r faultRepository) Within(ctx context.Context, fn func(identity.Tx) error) error {
	if r.mode == "delayed-first-operation" {
		select {
		case <-time.After(2200 * time.Millisecond):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if r.mode == "rollback" {
		return r.inner.Within(ctx, func(tx identity.Tx) error {
			if e := fn(tx); e != nil {
				return e
			}
			return identity.ErrUnavailable
		})
	}
	e := r.inner.Within(ctx, fn)
	if e == nil && r.mode == "commit-ack-lost" {
		return identity.ErrTimeout
	}
	return e
}
func TestIDFFailureAndRaceBoundaries(t *testing.T) {
	ctx := context.Background()
	app, offline, name := database(t, 7)
	ex := migrations.Executor{DB: offline, Database: name}
	if e := ex.Up(ctx, 3); e != nil {
		t.Fatal(e)
	}
	store := &mysqlstore.Store{DB: app}
	if e := (&mysqlstore.Store{DB: offline}).Initialize(ctx, seed(t), nil); e != nil {
		t.Fatal(e)
	}
	svc, _ := identity.New(store, nil, "https://campus.test")
	login := func(u string) identity.Issued {
		t.Helper()
		o, e := svc.Login(ctx, u, "test-only-"+u, strings.Repeat("a", 32))
		if e != nil {
			t.Fatal(e)
		}
		return o
	}
	in := func(o identity.Issued, action, cid string) identity.Mutation {
		csrf, e := svc.GetCSRF(ctx, o.Refresh)
		if e != nil {
			t.Fatal(e)
		}
		return identity.Mutation{Action: action, Access: o.Body.AccessToken, Refresh: o.Refresh, Origin: "https://campus.test", CSRF: csrf, RequestID: strings.Repeat("a", 32), ClassID: func() (string, error) { return cid, nil }}
	}
	t.Run("SC05-refresh-versus-switch", func(t *testing.T) {
		o := login("teacher-a")
		b := login("teacher-b")
		a := in(o, "refresh", "")
		sw := in(o, "switch-class", b.Body.Principal.ClassID)
		before := count(t, app, "access_credentials")
		start := make(chan struct{})
		errs := make(chan error, 2)
		for _, request := range []identity.Mutation{a, sw} {
			go func(r identity.Mutation) { <-start; _, e := svc.Mutate(ctx, r); errs <- e }(request)
		}
		close(start)
		wins, losses := 0, 0
		for i := 0; i < 2; i++ {
			e := <-errs
			if e == nil {
				wins++
			} else if errors.Is(e, identity.ErrUnauthenticated) {
				losses++
			} else {
				t.Fatal(e)
			}
		}
		if wins != 1 || losses != 1 || count(t, app, "access_credentials") != before+1 {
			t.Fatal("race produced multiple writes")
		}
	})
	t.Run("SC12-commit-failure-distinction", func(t *testing.T) {
		for _, mode := range []string{"rollback", "commit-ack-lost"} {
			t.Run(mode, func(t *testing.T) {
				o := login("teacher-a")
				b := login("teacher-b")
				request := in(o, "switch-class", b.Body.Principal.ClassID)
				bad, _ := identity.New(faultRepository{store, mode}, nil, "https://campus.test")
				before := count(t, app, "access_credentials")
				out, e := bad.Mutate(ctx, request)
				if out.Refresh != "" || out.Body.AccessToken != "" {
					t.Fatal("credential leaked on failure")
				}
				var v int
				offline.QueryRow("SELECT version FROM sessions WHERE id=?", o.Body.Principal.SessionID).Scan(&v)
				if mode == "rollback" {
					if !errors.Is(e, identity.ErrUnavailable) || v != 1 || count(t, app, "access_credentials") != before {
						t.Fatal("rollback side effect")
					}
					if _, e = svc.Me(ctx, o.Body.AccessToken); e != nil {
						t.Fatal("rollback lost old credential")
					}
				} else {
					if !errors.Is(e, identity.ErrTimeout) || v != 2 || count(t, app, "access_credentials") != before+1 {
						t.Fatal("unknown commit repeated")
					}
					if _, e = svc.Me(ctx, o.Body.AccessToken); !errors.Is(e, identity.ErrUnauthenticated) {
						t.Fatal("committed switch old token")
					}
					login("teacher-a")
				}
			})
		}
	})
	t.Run("SC08-membership-disable-revocation", func(t *testing.T) {
		o := login("student-a")
		if _, e := offline.Exec("UPDATE class_memberships SET active=0 WHERE user_id=?", o.Body.Principal.UserID); e != nil {
			t.Fatal("fixture")
		}
		if e := svc.AuthorizeResource(ctx, o.Body.AccessToken, identity.ReadPersonal, identity.Resource{Exists: true, ClassID: o.Body.Principal.ClassID, OwnerUserID: o.Body.Principal.UserID}); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("stale principal allowed")
		}
		if _, e := svc.GetCSRF(ctx, o.Refresh); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("revoked membership refresh")
		}
		b := login("student-b")
		if e := svc.Disable(ctx, b.Body.Principal.UserID, strings.Repeat("a", 32)); e != nil {
			t.Fatal(e)
		}
		if _, e := svc.Me(ctx, b.Body.AccessToken); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("disabled access")
		}
		if _, e := svc.Login(ctx, "student-b", "test-only-student-b", strings.Repeat("a", 32)); !errors.Is(e, identity.ErrUnauthenticated) {
			t.Fatal("disabled login")
		}
	})
	t.Run("SC18-common-five-second-budget", func(t *testing.T) {
		o := login("teacher-a")
		tx, e := offline.BeginTx(ctx, nil)
		if e != nil {
			t.Fatal(e)
		}
		defer tx.Rollback()
		var id string
		if e = tx.QueryRow("SELECT id FROM users WHERE id=? FOR UPDATE", o.Body.Principal.UserID).Scan(&id); e != nil {
			t.Fatal("lock fixture")
		}
		start := time.Now()
		delayed, _ := identity.New(faultRepository{store, "delayed-first-operation"}, nil, "https://campus.test")
		_, e = delayed.Me(ctx, o.Body.AccessToken)
		elapsed := time.Since(start)
		if !errors.Is(e, identity.ErrTimeout) {
			t.Fatal("database budget", e)
		}
		if elapsed > 6*time.Second {
			t.Fatal("unbounded wait")
		}
		t.Log("locked database bounded duration", elapsed.Round(time.Millisecond))
		tx.Rollback()
		if _, e = svc.Me(ctx, o.Body.AccessToken); e != nil {
			t.Fatal("lock recovery")
		}
	})
	t.Run("SC18-CA-target-and-DML-role", func(t *testing.T) {
		for _, raw := range []string{"", strings.Replace(os.Getenv("MYSQL_DSN"), "tls=true", "tls=skip-verify", 1), strings.Replace(os.Getenv("MYSQL_DSN"), "tls=true", "tls=preferred", 1), os.Getenv("MYSQL_DSN") + "&multiStatements=true"} {
			if _, e := mysqlstore.Connector(raw, os.Getenv("MYSQL_CA_FILE"), false); e == nil {
				t.Fatal("unsafe DSN")
			}
		}
		if _, e := mysqlstore.Connector(os.Getenv("MYSQL_DSN"), "/nonexistent-ca", false); e == nil {
			t.Fatal("missing CA")
		}
		if _, e := app.Exec("CREATE TABLE prohibited_ddl (id INT)"); e == nil {
			t.Fatal("application DDL privilege")
		}
	})
	t.Run("SC18-unavailable-and-recovery", func(t *testing.T) {
		o := login("teacher-a")
		app.Close()
		if _, e := svc.Me(ctx, o.Body.AccessToken); !errors.Is(e, identity.ErrUnavailable) {
			t.Fatal("closed dependency allowed")
		}
		raw := strings.Replace(os.Getenv("MYSQL_DSN"), "/idf_test_0?", "/idf_test_7?", 1)
		a, e := mysqlstore.Open(raw, os.Getenv("MYSQL_CA_FILE"), false)
		if e != nil {
			t.Fatal(e)
		}
		defer a.Close()
		restored, _ := identity.New(&mysqlstore.Store{DB: a}, nil, "https://campus.test")
		if _, e = restored.Me(ctx, o.Body.AccessToken); e != nil {
			t.Fatal("recovery lost persisted session")
		}
	})
}
