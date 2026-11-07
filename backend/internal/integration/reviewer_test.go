//go:build integration

package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/httpserver"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

// Reviewer-owned replay for IDF-SC-06/08/09/10/11/13/17/20. It uses its own
// real schema and compares complete persistent rows, not just HTTP status/counts.
func TestIDFReviewerIndependentAuthorizationAndRevocation(t *testing.T) {
	ctx := context.Background()
	app, offline, name := database(t, 9)
	if (migrations.Executor{DB: offline, Database: name}).Up(ctx, 3) != nil {
		t.Fatal("review schema migration failed")
	}
	if (&mysqlstore.Store{DB: offline}).Initialize(ctx, seed(t), nil) != nil {
		t.Fatal("review seed failed")
	}
	repo := &mysqlstore.Store{DB: app}
	svc, err := identity.New(repo, nil, "https://campus.test")
	if err != nil {
		t.Fatal("review service assembly failed")
	}
	var logs bytes.Buffer
	server := httptest.NewTLSServer(httpserver.IdentityHandler(slog.New(slog.NewJSONHandler(&logs, nil)), svc, repo, config.Identity{Origin: "https://campus.test"}, identity.NewLimiter(nil)))
	defer server.Close()
	client := server.Client() // Trust only this test server's certificate.
	type response struct {
		status  int
		body    []byte
		header  http.Header
		cookies []*http.Cookie
	}
	request := func(method, path, body, access, refresh, csrf string) response {
		t.Helper()
		r, e := http.NewRequest(method, server.URL+path, strings.NewReader(body))
		if e != nil {
			t.Fatal("request assembly failed")
		}
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "https://campus.test")
		r.Header.Set("X-Request-ID", "client-controlled")
		r.Header.Set("X-Role", "teacher")
		r.Header.Set("X-Class-ID", "999")
		if access != "" {
			r.Header.Set("Authorization", "Bearer "+access)
		}
		if refresh != "" {
			r.AddCookie(&http.Cookie{Name: "campus_refresh", Value: refresh})
		}
		if csrf != "" {
			r.Header.Set("X-CSRF-Token", csrf)
		}
		out, e := client.Do(r)
		if e != nil {
			t.Fatal("trusted HTTPS request failed")
		}
		defer out.Body.Close()
		b, e := io.ReadAll(out.Body)
		if e != nil {
			t.Fatal("response read failed")
		}
		if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(out.Header.Get("X-Request-ID")) || out.Header.Get("Cache-Control") != "no-store" {
			t.Fatal("server request ID or sensitive response cache contract failed")
		}
		return response{out.StatusCode, b, out.Header, out.Cookies()}
	}
	login := func(username string) identity.Issued {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"username": username, "password": "test-only-" + username})
		r := request("POST", "/api/v1/auth/login", string(body), "", "", "")
		var out identity.Issued
		if r.status != 200 || json.Unmarshal(r.body, &out.Body) != nil || len(r.cookies) != 1 || !r.cookies[0].Secure || !r.cookies[0].HttpOnly {
			t.Fatal("review login failed")
		}
		out.Refresh = r.cookies[0].Value
		return out
	}
	denied := func(r response, status int, code string) {
		t.Helper()
		var body struct {
			Error struct {
				Code    string `json:"code"`
				Fields  []any  `json:"fields"`
				Details any    `json:"details"`
			} `json:"error"`
			RequestID string `json:"request_id"`
		}
		if r.status != status || json.Unmarshal(r.body, &body) != nil || body.Error.Code != code || body.Error.Fields == nil || len(body.Error.Fields) != 0 || body.Error.Details != nil || body.RequestID != r.header.Get("X-Request-ID") || len(r.cookies) != 0 {
			t.Fatal("review denial response or cookie side effect failed")
		}
	}
	a, a2, b, peer := login("student-a"), login("student-a"), login("student-b"), login("student-a2")
	before := reviewRows(t, app)
	denied(request("GET", "/api/v1/me", "", "", "", ""), 401, "UNAUTHENTICATED")
	for _, tc := range []struct {
		action   identity.Action
		resource identity.Resource
		want     error
	}{
		{identity.ReadPersonal, identity.Resource{Exists: true, ClassID: a.Body.Principal.ClassID, OwnerUserID: a.Body.Principal.UserID}, nil},
		{identity.Teach, identity.Resource{Exists: true, ClassID: a.Body.Principal.ClassID}, identity.ErrForbidden},
		{identity.ReadPersonal, identity.Resource{Exists: true, ClassID: a.Body.Principal.ClassID, OwnerUserID: peer.Body.Principal.UserID}, identity.ErrNotFound},
		{identity.ReadClass, identity.Resource{Exists: true, ClassID: b.Body.Principal.ClassID}, identity.ErrNotFound},
		{identity.ReadClass, identity.Resource{}, identity.ErrNotFound},
		{identity.Action("unregistered"), identity.Resource{Exists: true, ClassID: a.Body.Principal.ClassID}, identity.ErrForbidden},
	} {
		if e := svc.AuthorizeResource(ctx, a.Body.AccessToken, tc.action, tc.resource); !errors.Is(e, tc.want) {
			t.Fatal("review resource authorization failed")
		}
	}
	denied(request("POST", "/api/v1/auth/logout", "", a.Body.AccessToken, a.Refresh, "wrong"), 403, "FORBIDDEN")
	if !reflect.DeepEqual(before, reviewRows(t, app)) {
		t.Fatal("denial changed persistent values or audit")
	}
	t.Log("IDF-SC-09/10/11/13/20: own allowed; teacher/other student/cross-class/unknown denied; all rows unchanged")

	csrf, e := svc.GetCSRF(ctx, a.Refresh)
	if e != nil {
		t.Fatal("review CSRF recovery failed")
	}
	logout := request("POST", "/api/v1/auth/logout", "", a.Body.AccessToken, a.Refresh, csrf)
	if logout.status != 204 || len(logout.body) != 0 || len(logout.cookies) != 1 || logout.cookies[0].MaxAge != -1 || !logout.cookies[0].Secure || !logout.cookies[0].HttpOnly || logout.cookies[0].Path != "/api/v1/auth" || logout.cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatal("review logout response failed")
	}
	var auditID string
	if app.QueryRow("SELECT request_id FROM auth_audit WHERE action='logout' AND session_id=?", a.Body.Principal.SessionID).Scan(&auditID) != nil || auditID != logout.header.Get("X-Request-ID") || !strings.Contains(logs.String(), auditID) {
		t.Fatal("review logout audit correlation failed")
	}
	var revoked bool
	if app.QueryRow("SELECT revoked FROM sessions WHERE id=?", a.Body.Principal.SessionID).Scan(&revoked) != nil || !revoked {
		t.Fatal("logout not persisted")
	}
	afterLogout := reviewRows(t, app)
	denied(request("GET", "/api/v1/me", "", a.Body.AccessToken, "", ""), 401, "UNAUTHENTICATED")
	denied(request("GET", "/api/v1/auth/csrf", "", "", a.Refresh, ""), 401, "UNAUTHENTICATED")
	if request("GET", "/api/v1/me", "", a2.Body.AccessToken, "", "").status != 200 || !reflect.DeepEqual(afterLogout, reviewRows(t, app)) {
		t.Fatal("logout affected other session or denial wrote data")
	}
	t.Log("IDF-SC-06/17: logout 204; old access/refresh 401; other session 200; database revocation and HTTP/audit request ID agree")

	if svc.Revoke(ctx, a.Body.Principal.UserID, strings.Repeat("c", 32)) != nil {
		t.Fatal("review revoke failed")
	}
	var n int
	if app.QueryRow("SELECT COUNT(*) FROM sessions WHERE user_id=? AND revoked=1", a.Body.Principal.UserID).Scan(&n) != nil || n != 2 {
		t.Fatal("user revocation not persisted to both sessions")
	}
	afterRevoke := reviewRows(t, app)
	denied(request("GET", "/api/v1/me", "", a2.Body.AccessToken, "", ""), 401, "UNAUTHENTICATED")
	denied(request("GET", "/api/v1/auth/csrf", "", "", a2.Refresh, ""), 401, "UNAUTHENTICATED")
	if request("GET", "/api/v1/me", "", b.Body.AccessToken, "", "").status != 200 || !reflect.DeepEqual(afterRevoke, reviewRows(t, app)) {
		t.Fatal("user revocation affected unrelated user or denial wrote data")
	}
	for _, secret := range []string{a.Body.AccessToken, a.Refresh, a2.Body.AccessToken, a2.Refresh, b.Body.AccessToken, b.Refresh, peer.Body.AccessToken, peer.Refresh, csrf, "test-only-student-a", "test-only-student-b"} {
		if strings.Contains(logs.String(), secret) {
			t.Fatal("review HTTP log contains sensitive value")
		}
	}
	t.Log("IDF-SC-08: remaining user session revoked; old access/refresh 401; unrelated user 200; denial rows unchanged; logs omit credentials")
}

// Sensitive values remain in memory and are never included in a failure message.
func reviewRows(t *testing.T, db *sql.DB) map[string][][]string {
	t.Helper()
	out := map[string][][]string{}
	for _, table := range []string{"users", "classes", "class_memberships", "sessions", "access_credentials", "auth_audit"} {
		rows, e := db.Query("SELECT * FROM " + table + " ORDER BY 1,2")
		if e != nil {
			t.Fatal("review snapshot query failed")
		}
		cols, e := rows.Columns()
		if e != nil {
			rows.Close()
			t.Fatal("review snapshot columns failed")
		}
		for rows.Next() {
			values := make([]sql.RawBytes, len(cols))
			args := make([]any, len(cols))
			for i := range values {
				args[i] = &values[i]
			}
			if rows.Scan(args...) != nil {
				rows.Close()
				t.Fatal("review snapshot scan failed")
			}
			copied := make([]string, len(values))
			for i, value := range values {
				if value == nil {
					copied[i] = "null:"
				} else {
					copied[i] = "value:" + string(value)
				}
			}
			out[table] = append(out[table], copied)
		}
		e = rows.Err()
		rows.Close()
		if e != nil {
			t.Fatal("review snapshot iteration failed")
		}
	}
	return out
}
