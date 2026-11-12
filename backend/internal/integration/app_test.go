//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identityapp"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// Runs after creating its own migrated schema; no ordering dependency on other tests.
func TestIDFAssemblyHealthAndConfiguration(t *testing.T) {
	_, db, name := database(t, 10)
	ex := migrations.Executor{DB: db, Database: name}
	if ex.Up(context.Background(), migrations.Target) != nil {
		t.Fatal("migration")
	}
	lookup := func(k string) (string, bool) {
		switch k {
		case "AUTH_TRUSTED_ORIGIN":
			return "https://campus.test", true
		case "AUTH_TRUSTED_PROXY_CIDRS":
			return "127.0.0.1/32", true
		case "MYSQL_DSN":
			value, ok := os.LookupEnv(k)
			return strings.Replace(value, "/idf_test_0?", "/idf_test_10?", 1), ok
		case "MYSQL_MIGRATION_DSN":
			t.Fatal("server read offline credential")
		}
		return os.LookupEnv(k)
	}
	for _, key := range []string{"MYSQL_DSN", "MYSQL_CA_FILE", "AUTH_TRUSTED_ORIGIN", "AUTH_TRUSTED_PROXY_CIDRS"} {
		for _, missing := range []string{"", " "} {
			_, close, e := identityapp.New(context.Background(), func(k string) (string, bool) {
				if k == key {
					return missing, true
				}
				return lookup(k)
			}, slog.New(slog.NewJSONHandler(io.Discard, nil)))
			if e == nil {
				close()
				t.Fatal("missing/blank config accepted", key)
			}
		}
	}
	h, close, e := identityapp.New(context.Background(), lookup, slog.New(slog.NewJSONHandler(io.Discard, nil)))
	if e != nil {
		t.Fatal("assembly", e)
	}
	defer close()
	server := httptest.NewTLSServer(h)
	defer server.Close()
	client := server.Client()
	check := func(want int, state string) {
		t.Helper()
		r, e := client.Get(server.URL + "/health")
		if e != nil {
			t.Fatal("trusted TLS health")
		}
		defer r.Body.Close()
		var body struct {
			Status       string            `json:"status"`
			Dependencies map[string]string `json:"dependencies"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || r.StatusCode != want || body.Dependencies["mysql"] != state || len(body.Dependencies) != 1 {
			t.Fatal("identity health contract")
		}
	}
	check(200, "up")
	cases := []struct {
		body string
		want int
	}{
		{`{"username":"u","password":"p"}`, 401},
		{`{"username":"` + strings.Repeat("界", 64) + `","password":"` + strings.Repeat("界", 128) + `"}`, 401},
		{`{"username":"` + strings.Repeat("界", 65) + `","password":"p"}`, 400},
		{`{"username":"u","password":"` + strings.Repeat("界", 129) + `"}`, 400},
		{`{"username":"","password":"p"}`, 400},
		{`{"username":"u","password":""}`, 400},
	}
	base := `{"username":"u","password":"p"}`
	cases = append(cases, struct {
		body string
		want int
	}{base + strings.Repeat(" ", 65536-len(base)), 401})
	for _, tc := range cases {
		r, e := client.Post(server.URL+"/api/v1/auth/login", "application/json", strings.NewReader(tc.body))
		if e != nil {
			t.Fatal("HTTP boundary")
		}
		io.Copy(io.Discard, r.Body)
		r.Body.Close()
		if r.StatusCode != tc.want {
			t.Fatalf("boundary status %d want %d", r.StatusCode, tc.want)
		}
	}
	close()
	check(503, "down")
	h2, close2, e := identityapp.New(context.Background(), lookup, slog.New(slog.NewJSONHandler(io.Discard, nil)))
	if e != nil {
		t.Fatal("health recovery")
	}
	defer close2()
	second := httptest.NewTLSServer(h2)
	defer second.Close()
	r, e := second.Client().Get(second.URL + "/health")
	if e != nil {
		t.Fatal("recovery request")
	}
	r.Body.Close()
	if r.StatusCode != http.StatusOK {
		t.Fatal("recovery not healthy")
	}
}
