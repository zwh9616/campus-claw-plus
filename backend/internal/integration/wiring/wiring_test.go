//go:build integration

// Package wiring tests the actual Nginx -> Go -> TLS MySQL path, without
// switching the production phase. No response/credential bodies are logged.
package wiring

import (
	"bytes"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"
)

func TestIDFWiring(t *testing.T) {
	ca, err := os.ReadFile("/fixtures/ca.pem")
	if err != nil {
		t.Fatal("CA unavailable")
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		t.Fatal("invalid CA")
	}
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Timeout: 7 * time.Second, Jar: jar, Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}}}
	defer client.CloseIdleConnections()
	call := func(method, path, body, access, csrf string, want int) (map[string]any, *http.Response) {
		t.Helper()
		req, _ := http.NewRequest(method, "https://campus.test"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://campus.test")
		req.Header.Set("X-Request-ID", "untrusted-client-value")
		req.Header.Set("X-Real-IP", "203.0.113.222")
		req.Header.Set("X-Forwarded-For", "203.0.113.222")
		if access != "" {
			req.Header.Set("Authorization", "Bearer "+access)
		}
		if csrf != "" {
			req.Header.Set("X-CSRF-Token", csrf)
		}
		start := time.Now()
		res, err := client.Do(req)
		if err != nil {
			t.Fatal("trusted HTTPS request failed")
		}
		defer res.Body.Close()
		if res.StatusCode != want {
			t.Fatalf("%s %s status=%d want=%d", method, path, res.StatusCode, want)
		}
		if path == "/health" && time.Since(start) > 3500*time.Millisecond {
			t.Fatal("health exceeded 3s budget plus transport allowance")
		}
		if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(res.Header.Get("X-Request-ID")) {
			t.Fatal("server request id missing")
		}
		data, err := io.ReadAll(io.LimitReader(res.Body, 65537))
		if err != nil {
			t.Fatal("response read")
		}
		var out map[string]any
		if want != 204 && json.Unmarshal(data, &out) != nil {
			t.Fatal("invalid JSON response")
		}
		return out, res
	}
	seed, err := os.ReadFile("/fixtures/seed.json")
	if err != nil {
		t.Fatal("test seed unavailable")
	}
	var input struct {
		Users []struct {
			Username string `json:"username"`
			Password string `json:"password"`
		} `json:"users"`
	}
	if json.Unmarshal(seed, &input) != nil || len(input.Users) == 0 {
		t.Fatal("test seed invalid")
	}
	login, _ := json.Marshal(map[string]string{"username": input.Users[0].Username, "password": input.Users[0].Password})
	if os.Getenv("WIRING_EXPECT") == "down" {
		body, _ := call("GET", "/health", "", "", "", 503)
		deps, _ := body["dependencies"].(map[string]any)
		if len(body) != 2 || body["status"] != "error" || len(deps) != 1 || deps["mysql"] != "down" {
			t.Fatal("down health contract")
		}
		body, res := call("POST", "/api/v1/auth/login", string(login), "", "", 503)
		e, _ := body["error"].(map[string]any)
		if e["code"] != "DEPENDENCY_UNAVAILABLE" || len(res.Cookies()) != 0 {
			t.Fatal("DB failure issued credentials or wrong error")
		}
		return
	}
	body, _ := call("GET", "/health", "", "", "", 200)
	deps, _ := body["dependencies"].(map[string]any)
	if len(body) != 2 || body["status"] != "ok" || len(deps) != 1 || deps["mysql"] != "up" {
		t.Fatal("up health contract")
	}
	res, err := client.Get("https://campus.test/")
	if err != nil {
		t.Fatal("static HTTPS page")
	}
	page, _ := io.ReadAll(io.LimitReader(res.Body, 65536))
	res.Body.Close()
	if res.StatusCode != 200 || !bytes.Contains(page, []byte("<html")) {
		t.Fatal("same-origin frontend missing")
	}
	for _, cfg := range []*tls.Config{{MinVersion: tls.VersionTLS12}, {RootCAs: pool, ServerName: "wrong.test", MinVersion: tls.VersionTLS12}} {
		bad := &http.Client{Timeout: 4 * time.Second, Transport: &http.Transport{TLSClientConfig: cfg}}
		if response, err := bad.Get("https://campus.test/health"); err == nil {
			response.Body.Close()
			t.Fatal("untrusted CA or wrong hostname accepted")
		}
		bad.CloseIdleConnections()
	}
	tooLarge, _ := call("POST", "/api/v1/auth/login", strings.Repeat("x", 65537), "", "", 413)
	problem, _ := tooLarge["error"].(map[string]any)
	if problem["code"] != "PAYLOAD_TOO_LARGE" {
		t.Fatal("proxy replaced JSON payload limit with an HTML error")
	}
	body, res = call("POST", "/api/v1/auth/login", string(login), "", "", 200)
	access, _ := body["access_token"].(string)
	principal, _ := body["principal"].(map[string]any)
	if access == "" || principal["role"] != "teacher" {
		t.Fatal("real database login missing")
	}
	cookies := res.Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode || cookies[0].Path != "/api/v1/auth" {
		t.Fatal("secure cookie attributes")
	}
	stable, _ := json.Marshal([]any{principal["user_id"], principal["class_id"]})
	hash := sha256.Sum256(stable)
	proof := []byte(hex.EncodeToString(hash[:]))
	file := "/fixtures/persistence-proof"
	if os.Getenv("WIRING_EXPECT") == "persist" {
		previous, err := os.ReadFile(file)
		if err != nil || !bytes.Equal(previous, proof) {
			t.Fatal("account/class changed across container recreation")
		}
	} else if os.WriteFile(file, proof, 0600) != nil {
		t.Fatal("persistence proof write")
	}
	call("GET", "/api/v1/me", "", access, "", 200)
	body, _ = call("GET", "/api/v1/auth/csrf", "", "", "", 200)
	csrf, _ := body["csrf_token"].(string)
	if csrf == "" {
		t.Fatal("CSRF missing")
	}
	private, _ := json.Marshal([]string{access, cookies[0].Value, csrf})
	// Container and caller UIDs may differ. The caller owns the enclosing 0700
	// disposable directory; this test-only file is removed before the run ends.
	if os.WriteFile("/fixtures/credential-proof", private, 0644) != nil {
		t.Fatal("private log exclusion proof write")
	}
	call("POST", "/api/v1/auth/logout", "", access, csrf, 204)
	call("GET", "/api/v1/me", "", access, "", 401)
	// Retain only an irreversible proof; the runner verifies log correlation.
	if os.WriteFile("/fixtures/request-proof", []byte(res.Header.Get("X-Request-ID")), 0644) != nil {
		t.Fatal("request proof write")
	}
	t.Log("IDF-SC-01/06/14/15/17/18 trusted HTTPS, TLS rejection, login/logout and persistence assertions passed")
}
