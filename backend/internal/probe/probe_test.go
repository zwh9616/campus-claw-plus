package probe

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestProbeContract(t *testing.T) {
	for _, test := range []struct {
		name, body, media, id string
		status                int
		valid                 bool
	}{
		{"normal", `{"status":"ok","dependencies":{"mysql":"up"}}`, "application/json; charset=utf-8", "0123456789abcdef0123456789abcdef", 200, true},
		{"old_skeleton_rejected", `{"status":"ok","dependencies":{}}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"database_down", `{"status":"error","dependencies":{"mysql":"down"}}`, "application/json", "0123456789abcdef0123456789abcdef", 503, false},
		{"wrong_dependency", `{"status":"ok","dependencies":{"mysql":"down"}}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"wrong_status", `{"status":"ok","dependencies":{"mysql":"up"}}`, "application/json", "0123456789abcdef0123456789abcdef", 503, false},
		{"bad_json", "not-json", "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"wrong_media", `{"status":"ok","dependencies":{"mysql":"up"}}`, "text/html", "0123456789abcdef0123456789abcdef", 200, false},
		{"missing_id", `{"status":"ok","dependencies":{"mysql":"up"}}`, "application/json", "", 200, false},
		{"missing_dependencies", `{"status":"ok"}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"null_dependencies", `{"status":"ok","dependencies":null}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"extra_field", `{"status":"ok","dependencies":{"mysql":"up"},"extra":true}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"extra_document", `{"status":"ok","dependencies":{"mysql":"up"}}{}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", test.media)
				w.Header().Set("X-Request-ID", test.id)
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			err := Check(context.Background(), server.URL)
			if (err == nil) != test.valid {
				t.Fatalf("valid=%v err=%v", test.valid, err)
			}
		})
	}
}

// DO-SC-12: both header waits and slow bodies must fail inside the approved3s
// total probe budget. The former3.5s client would accept these valid responses.
func TestDOProbeRejectsSlowHeadersAndBody(t *testing.T) {
	for _, bodyFirst := range []bool{false, true} {
		t.Run(map[bool]string{false: "headers", true: "body"}[bodyFirst], func(t *testing.T) {
			t.Parallel()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Request-ID", "0123456789abcdef0123456789abcdef")
				if bodyFirst {
					w.WriteHeader(http.StatusOK)
					w.(http.Flusher).Flush()
				}
				timer := time.NewTimer(3200 * time.Millisecond)
				defer timer.Stop()
				select {
				case <-r.Context().Done():
					return
				case <-timer.C:
					_, _ = w.Write([]byte(`{"status":"ok","dependencies":{"mysql":"up"}}`))
				}
			}))
			defer server.Close()
			if err := Check(context.Background(), server.URL); err == nil {
				t.Fatal("probe accepted a response outside its3s total budget")
			}
		})
	}
}
