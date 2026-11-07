package httpserver

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/observability"
)

// PB-02/PB-07 / SC-02/03/16: actual response and correlated single-line log.
func TestHealthNormalAndLog(t *testing.T) {
	var logs bytes.Buffer
	handler := Handler(observability.NewLogger(&logs), healthyDB{})
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
		if len(body) != 2 || string(body["status"]) != `"ok"` || string(body["dependencies"]) != `{"mysql":"up"}` {
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
			Handler(observability.NewLogger(&logs), healthyDB{}).ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
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

type healthyDB struct{}

func (healthyDB) Ping(context.Context) error { return nil }

// IDF-SC-17: every health request checks the dependency with its own budget;
// no cached success, leaked driver message, or skeleton success on failure.
type changingDB struct {
	calls int
	t     *testing.T
}

func (db *changingDB) Ping(ctx context.Context) error {
	db.calls++
	deadline, ok := ctx.Deadline()
	if !ok || time.Until(deadline) > 3*time.Second || time.Until(deadline) < 2500*time.Millisecond {
		db.t.Fatal("health must supply a fresh 3s total budget")
	}
	if db.calls > 1 {
		return errors.New("sensitive-database-detail")
	}
	return nil
}
func TestIdentityHealthChecksEveryRequestAndFailsClosed(t *testing.T) {
	var logs bytes.Buffer
	db := &changingDB{t: t}
	h := Handler(observability.NewLogger(&logs), db)
	for i, status := range []int{200, 503} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "/health", nil))
		if w.Code != status {
			t.Fatalf("request %d status=%d want=%d", i, w.Code, status)
		}
		if strings.Contains(w.Body.String(), "sensitive") || strings.Contains(logs.String(), "sensitive") {
			t.Fatal("dependency error leaked")
		}
		if i == 1 && w.Body.String() != "{\"dependencies\":{\"mysql\":\"down\"},\"status\":\"error\"}\n" {
			t.Fatal("down payload must be unique and exact")
		}
	}
	if db.calls != 2 {
		t.Fatal("health reused a previous dependency result")
	}
}
