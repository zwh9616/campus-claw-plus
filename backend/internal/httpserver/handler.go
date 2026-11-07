package httpserver

import (
	"context"
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

// Pinger is the single health dependency boundary, supplied by the real store.
type Pinger interface{ Ping(context.Context) error }

func writeHealth(w http.ResponseWriter, r *http.Request, db Pinger) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	status, state, code := "ok", "up", http.StatusOK
	if db == nil || db.Ping(ctx) != nil {
		status, state, code = "error", "down", http.StatusServiceUnavailable
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]any{"status": status, "dependencies": map[string]string{"mysql": state}})
}

// Handler keeps transport regression tests on the same identity health contract.
func Handler(logger *slog.Logger, db Pinger) http.Handler { return Observe(logger, healthHandler(db)) }

// Observe gives all routes server-generated identifiers and body-free logs.
func Observe(logger *slog.Logger, next http.Handler) http.Handler {
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
		next.ServeHTTP(result, r)
	})
}
func healthHandler(db Pinger) http.Handler {
	return http.HandlerFunc(func(result http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			http.NotFound(result, r)
			return
		}
		if r.Method != http.MethodGet {
			result.Header().Set("Allow", http.MethodGet)
			http.Error(result, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		writeHealth(result, r, db)
	})
}
