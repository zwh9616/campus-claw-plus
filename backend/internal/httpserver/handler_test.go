package httpserver

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"mime"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/zwh9616/campus-claw-plus/backend/internal/observability"
)

// PB-02/PB-07 / SC-02/03/16: actual response and correlated single-line log.
func TestHealthNormalAndLog(t *testing.T) {
	var logs bytes.Buffer
	handler := Handler(observability.NewLogger(&logs))
	ids := map[string]bool{}
	for i := 0; i < 2; i++ {
		request := httptest.NewRequest(http.MethodGet, "/health?secret=must-not-log", nil)
		request.Header.Set("X-Request-ID", "client-controlled")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("status=%d", response.Code)
		}
		media, _, err := mime.ParseMediaType(response.Header().Get("Content-Type"))
		if err != nil || media != "application/json" {
			t.Fatal("wrong content type")
		}
		var body map[string]json.RawMessage
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if len(body) != 2 || string(body["status"]) != `"ok"` || string(body["dependencies"]) != "{}" {
			t.Fatalf("wrong health contract: %s", response.Body.String())
		}
		id := response.Header().Get("X-Request-ID")
		decoded, err := hex.DecodeString(id)
		if err != nil || len(decoded) != 16 || ids[id] {
			t.Fatalf("invalid or repeated id %q", id)
		}
		ids[id] = true
		line := strings.TrimSpace(logs.String())
		if strings.Contains(line, "\n") || strings.Contains(line, "must-not-log") || strings.Contains(line, "client-controlled") {
			t.Fatal("multiline or sensitive log")
		}
		var log map[string]any
		if err := json.Unmarshal([]byte(line), &log); err != nil {
			t.Fatal(err)
		}
		if log["request_id"] != id || log["status"] != float64(200) || log["path"] != "/health" {
			t.Fatalf("wrong correlated log: %#v", log)
		}
		for _, key := range []string{"ts", "level", "module", "message", "method", "duration_ms"} {
			if _, ok := log[key]; !ok {
				t.Fatalf("missing %s", key)
			}
		}
		logs.Reset()
	}
}

func TestHTTPFailureRoutes(t *testing.T) {
	for _, test := range []struct {
		name, method, path string
		status             int
	}{
		{"missing", http.MethodGet, "/missing", 404},
		{"method", http.MethodPost, "/health", 405},
	} {
		t.Run(test.name, func(t *testing.T) {
			var logs bytes.Buffer
			response := httptest.NewRecorder()
			Handler(observability.NewLogger(&logs)).ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
			if response.Code != test.status {
				t.Fatalf("status=%d", response.Code)
			}
			if response.Header().Get("X-Request-ID") == "" {
				t.Fatal("missing identifier on error")
			}
			if test.status == 405 && response.Header().Get("Allow") != "GET" {
				t.Fatal("missing Allow")
			}
		})
	}
}
