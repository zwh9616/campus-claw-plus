//go:build integration

// Package wiring tests the actual Nginx -> Go -> TLS MySQL path, without
// the activated default production artifact. No response/credential bodies are logged.
package wiring

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestIDFWiring(t *testing.T) {
	if os.Getenv("WIRING_EXPECT") == "lookup" {
		prepareClassFixture(t)
		return
	}
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
	var observedSecrets []string
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
		if strings.HasPrefix(path, "/health") && want == 200 && time.Since(start) > 2*time.Second {
			t.Fatal("healthy request exceeded original 2000ms regression limit")
		}
		if strings.HasPrefix(path, "/health") && time.Since(start) > 3500*time.Millisecond {
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
		for _, key := range []string{"access_token", "csrf_token"} {
			if value, ok := out[key].(string); ok && value != "" {
				observedSecrets = append(observedSecrets, value)
			}
		}
		for _, cookie := range res.Cookies() {
			if cookie.Value != "" {
				observedSecrets = append(observedSecrets, cookie.Value)
			}
		}
		if len(observedSecrets) > 0 {
			private, _ := json.Marshal(observedSecrets)
			if os.WriteFile("/fixtures/credential-proof", private, 0644) != nil {
				t.Fatal("private exclusion proof")
			}
		}
		return out, res
	}
	if os.Getenv("WIRING_EXPECT") == "stopped" {
		for _, path := range []string{"/health", "/"} {
			if res, err := client.Get("https://campus.test" + path); err == nil {
				res.Body.Close()
				t.Fatal("stopped project still responds")
			}
		}
		return
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
	body, firstHealth := call("GET", "/health?token=verification-private", "", "", "", 200)
	_, secondHealth := call("GET", "/health", "", "", "", 200)
	if firstHealth.Header.Get("X-Request-ID") == secondHealth.Header.Get("X-Request-ID") {
		t.Fatal("request identifiers reused")
	}
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
	// DI-SC-01: a privately wired worker never opens these frozen public routes.
	for _, route := range []struct{ method, path string }{
		{"GET", "/api/v1/documents"}, {"POST", "/api/v1/documents"},
		{"GET", "/api/v1/documents/1"}, {"GET", "/api/v1/documents/1/download"},
		{"POST", "/api/v1/documents/1/retry"}, {"GET", "/api/v1/document-search"},
	} {
		req, _ := http.NewRequest(route.method, "https://campus.test"+route.path, strings.NewReader("{}"))
		req.Header.Set("Authorization", "Bearer "+access)
		req.Header.Set("Origin", "https://campus.test")
		res, e := client.Do(req)
		if e != nil {
			t.Fatal("frozen route request failed")
		}
		io.Copy(io.Discard, io.LimitReader(res.Body, 8192))
		res.Body.Close()
		if res.StatusCode != 404 {
			t.Fatal("frozen Document route became callable")
		}
	}
	if os.Getenv("WIRING_EXPECT") != "down" {
		verifyMRWiring(t, client, access)
		verifyATWiring(t, client, access, &observedSecrets)
	}
	body, _ = call("GET", "/api/v1/auth/csrf", "", "", "", 200)
	csrf, _ := body["csrf_token"].(string)
	if csrf == "" {
		t.Fatal("CSRF missing")
	}
	private, _ := json.Marshal(observedSecrets)
	// Container and caller UIDs may differ. The caller owns the enclosing 0700
	// disposable directory; this test-only file is removed before the run ends.
	if os.WriteFile("/fixtures/credential-proof", private, 0644) != nil {
		t.Fatal("private log exclusion proof write")
	}
	// Exercise the actual production entry point, with the old credentials
	// checked after refresh, and invalidated after class change and logout (D3).
	oldAccess := access
	body, _ = call("POST", "/api/v1/auth/refresh", "", "", csrf, 200)
	access, _ = body["access_token"].(string)
	if access == "" || access == oldAccess {
		t.Fatal("refresh did not rotate access")
	}
	call("GET", "/api/v1/me", "", oldAccess, "", 200) // D3: refresh preserves unexpired access.
	staleClient := *client
	staleClient.Jar = nil
	staleRequest, _ := http.NewRequest("GET", "https://campus.test/api/v1/auth/csrf", nil)
	staleRequest.AddCookie(cookies[0])
	staleResponse, err := staleClient.Do(staleRequest)
	if err != nil {
		t.Fatal("old-refresh verification request")
	}
	staleResponse.Body.Close()
	if staleResponse.StatusCode != 401 {
		t.Fatal("old refresh cookie was not invalidated")
	}
	body, _ = call("GET", "/api/v1/auth/csrf", "", "", "", 200)
	csrf, _ = body["csrf_token"].(string)
	targetBytes, err := os.ReadFile("/fixtures/class-target")
	if err != nil {
		t.Fatal("trusted fixture class target missing")
	}
	target := string(targetBytes)
	oldAccess = access
	change, _ := json.Marshal(map[string]string{"class_id": target})
	body, _ = call("POST", "/api/v1/auth/switch-class", string(change), access, csrf, 200)
	access, _ = body["access_token"].(string)
	switched, _ := body["principal"].(map[string]any)
	if switched["class_id"] != target {
		t.Fatal("teacher switch did not change trusted class")
	}
	call("GET", "/api/v1/me", "", oldAccess, "", 401)
	materialID, err := os.ReadFile("/fixtures/material-proof")
	if err != nil {
		t.Fatal("material persistence proof missing")
	}
	materialPath := "/api/v1/materials/" + string(materialID)
	call("GET", materialPath, "", oldAccess, "", 401)
	assignmentProof, err := os.ReadFile("/fixtures/assignment-proof")
	if err != nil {
		t.Fatal("AT persistence proof missing")
	}
	var atProof struct{ AssignmentID string }
	if json.Unmarshal(assignmentProof, &atProof) != nil || atProof.AssignmentID == "" {
		t.Fatal("AT invalid persistence proof")
	}
	assignmentPath := "/api/v1/assignments/" + atProof.AssignmentID
	call("GET", assignmentPath, "", oldAccess, "", 401)
	call("GET", assignmentPath, "", access, "", 404)
	crossClass, _ := call("GET", materialPath, "", access, "", 404)
	missingMaterial, _ := call("GET", "/api/v1/materials/9223372036854775807", "", access, "", 404)
	delete(crossClass, "request_id")
	delete(missingMaterial, "request_id")
	if !reflect.DeepEqual(crossClass, missingMaterial) {
		t.Fatal("MR-SC-02 cross-class response discloses material existence")
	}
	body, _ = call("GET", "/api/v1/auth/csrf", "", "", "", 200)
	csrf, _ = body["csrf_token"].(string)
	call("POST", "/api/v1/auth/logout", "", access, csrf, 204)
	call("GET", "/api/v1/me", "", access, "", 401)
	call("GET", "/api/v1/auth/csrf", "", "", "", 401)
	wrong, _ := json.Marshal(map[string]string{"username": input.Users[0].Username, "password": "incorrect-test-password"})
	_, denied := call("POST", "/api/v1/auth/login", string(wrong), "", "", 401)
	if len(denied.Cookies()) != 0 {
		t.Fatal("wrong password received credentials")
	}
	if len(input.Users) < 2 {
		t.Fatal("student fixture missing")
	}
	student, _ := json.Marshal(map[string]string{"username": input.Users[1].Username, "password": input.Users[1].Password})
	body, _ = call("POST", "/api/v1/auth/login", string(student), "", "", 200)
	access, _ = body["access_token"].(string)
	sp, _ := body["principal"].(map[string]any)
	if sp["role"] != "student" {
		t.Fatal("student trusted role")
	}
	call("GET", materialPath, "", access, "", 200)
	studentSearch, _ := call("GET", "/api/v1/search?q=%25_keyword", "", access, "", 200)
	items, ok := studentSearch["items"].([]any)
	if !ok || len(items) != 1 {
		t.Fatal("MR-SC-01 student material search missing")
	}
	citation, ok := items[0].(map[string]any)
	if !ok || citation["material_id"] != string(materialID) {
		t.Fatal("MR-SC-09 student source points to another material")
	}
	call("POST", materialPath+"/retry-index", "", access, "", 403)
	body, _ = call("GET", "/api/v1/auth/csrf", "", "", "", 200)
	csrf, _ = body["csrf_token"].(string)
	call("POST", "/api/v1/auth/switch-class", string(change), access, csrf, 403)
	call("GET", "/api/v1/me", "", access, "", 200)
	call("POST", "/api/v1/auth/logout", "", access, csrf, 204)
	call("GET", "/api/v1/me", "", access, "", 401)
	// Retain only an irreversible proof; the runner verifies log correlation.
	if os.WriteFile("/fixtures/request-proof", []byte(res.Header.Get("X-Request-ID")), 0644) != nil {
		t.Fatal("request proof write")
	}
	t.Log("IDF-SC-01/06/14/15/17/18 trusted HTTPS, TLS rejection, login/logout and persistence assertions passed")
}

// Trusted test setup runs on the data network, never exposing MySQL to the gateway.
func prepareClassFixture(t *testing.T) {
	rawEnv, err := os.ReadFile("/fixtures/backend.env")
	if err != nil {
		t.Fatal("fixture app input")
	}
	values := map[string]string{}
	for _, line := range strings.Split(string(rawEnv), "\n") {
		if key, value, ok := strings.Cut(line, "="); ok {
			decoded, e := strconv.Unquote(value)
			if e != nil {
				t.Fatal("fixture env encoding")
			}
			values[key] = decoded
		}
	}
	db, err := mysqlstore.Open(values["MYSQL_DSN"], values["MYSQL_CA_FILE"], false)
	if err != nil {
		t.Fatal("fixture read-only connection")
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var target string
	if db.QueryRowContext(ctx, "SELECT id FROM classes WHERE stable_key=?", "wiring-b").Scan(&target) != nil {
		t.Fatal("fixture class lookup")
	}
	if os.WriteFile("/fixtures/class-target", []byte(target), 0644) != nil {
		t.Fatal("fixture target proof")
	}
}
