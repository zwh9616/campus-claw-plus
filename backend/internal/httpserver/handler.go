package httpserver

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *responseWriter) Write(body []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}

// Handler implements PB-02 and PB-07. No database, credentials or model calls.
func Handler(logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		var bytes [16]byte
		if _, err := rand.Read(bytes[:]); err != nil {
			logger.Error("request identifier unavailable", "module", "http", "request_id", nil)
			http.Error(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		id := hex.EncodeToString(bytes[:])
		w.Header().Set("X-Request-ID", id)
		result := &responseWriter{ResponseWriter: w}
		defer func() {
			status := result.status
			if status == 0 {
				status = http.StatusOK
			}
			logger.Info("request completed", "module", "http", "request_id", id,
				"method", r.Method, "path", r.URL.Path, "status", status,
				"duration_ms", float64(time.Since(started).Microseconds())/1000)
		}()
		if r.URL.Path != "/health" {
			http.NotFound(result, r)
			return
		}
		if r.Method != http.MethodGet {
			result.Header().Set("Allow", http.MethodGet)
			http.Error(result, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		result.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(result).Encode(struct {
			Status       string            `json:"status"`
			Dependencies map[string]string `json:"dependencies"`
		}{Status: "ok", Dependencies: map[string]string{}})
	})
}
