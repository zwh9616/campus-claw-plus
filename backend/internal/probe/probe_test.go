package probe

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProbeContract(t *testing.T) {
	for _, test := range []struct {
		name, body, media, id string
		status                int
		valid                 bool
	}{
		{"normal", `{"status":"ok","dependencies":{}}`, "application/json; charset=utf-8", "0123456789abcdef0123456789abcdef", 200, true},
		{"wrong_status", `{"status":"ok","dependencies":{}}`, "application/json", "0123456789abcdef0123456789abcdef", 503, false},
		{"bad_json", "not-json", "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"wrong_media", `{"status":"ok","dependencies":{}}`, "text/html", "0123456789abcdef0123456789abcdef", 200, false},
		{"missing_id", `{"status":"ok","dependencies":{}}`, "application/json", "", 200, false},
		{"missing_dependencies", `{"status":"ok"}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"null_dependencies", `{"status":"ok","dependencies":null}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"extra_field", `{"status":"ok","dependencies":{},"extra":true}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
		{"extra_document", `{"status":"ok","dependencies":{}}{}`, "application/json", "0123456789abcdef0123456789abcdef", 200, false},
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
