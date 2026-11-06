package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/strictjson"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// IdentityHandler is composed only when the approved identity phase is activated.
// The current production server stays on skeleton until MySQL/TLS wiring lands.
func IdentityHandler(logger *slog.Logger, service *identity.Service, repo identity.Repository, cfg config.Identity, limiter *identity.Limiter) http.Handler {
	return Observe(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		routes := map[string]string{"/health": "GET", "/api/v1/auth/login": "POST", "/api/v1/auth/csrf": "GET", "/api/v1/auth/refresh": "POST", "/api/v1/me": "GET", "/api/v1/auth/logout": "POST", "/api/v1/auth/switch-class": "POST"}
		method, ok := routes[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		if r.Method != method {
			w.Header().Set("Allow", method)
			w.WriteHeader(405)
			return
		}
		if r.URL.Path == "/health" {
			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			defer cancel()
			status, state, code := "ok", "up", 200
			if repo.Ping(ctx) != nil {
				status, state, code = "error", "down", 503
			}
			w.WriteHeader(code)
			json.NewEncoder(w).Encode(map[string]any{"status": status, "dependencies": map[string]string{"mysql": state}})
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		body, e := strictjson.Read(r.Body)
		if e != nil {
			writeIdentityError(w, e)
			return
		}
		rid := w.Header().Get("X-Request-ID")
		access := ""
		auth := r.Header.Values("Authorization")
		if len(auth) == 1 && strings.HasPrefix(auth[0], "Bearer ") {
			access = strings.TrimPrefix(auth[0], "Bearer ")
		}
		refresh := ""
		cookies := r.CookiesNamed("campus_refresh")
		if len(cookies) == 1 {
			refresh = cookies[0].Value
		}
		single := func(name string) string {
			v := r.Header.Values(name)
			if len(v) != 1 {
				return ""
			}
			return v[0]
		}
		decode := func(dst any) error {
			media, _, e := mime.ParseMediaType(r.Header.Get("Content-Type"))
			if e != nil || media != "application/json" {
				return identity.ErrInvalid
			}
			if strictjson.Decode(body, dst) != nil {
				return identity.ErrInvalid
			}
			return nil
		}
		switch r.URL.Path {
		case "/api/v1/auth/login":
			var input struct {
				Username string `json:"username"`
				Password string `json:"password"`
			}
			if e = decode(&input); e != nil {
				break
			}
			if !identity.TextLength(input.Username, 1, 64) || !identity.TextLength(input.Password, 1, 128) {
				e = identity.ErrInvalid
				break
			}
			if allowed, retry := limiter.Allow(cfg.Source(r.RemoteAddr, r.Header.Values("X-Real-IP")), input.Username); !allowed {
				w.Header().Set("Retry-After", strconv.Itoa(retry))
				writeIdentityCode(w, 429, "RATE_LIMITED", "请稍后重试")
				return
			}
			var out identity.Issued
			out, e = service.Login(r.Context(), input.Username, input.Password, rid)
			if e == nil {
				setRefresh(w, out.Refresh, false)
				json.NewEncoder(w).Encode(out.Body)
			}
		case "/api/v1/me":
			var p identity.Principal
			p, e = service.Me(r.Context(), access)
			if e == nil {
				if len(body) != 0 {
					e = identity.ErrInvalid
					break
				}
				json.NewEncoder(w).Encode(p)
			}
		case "/api/v1/auth/csrf":
			var csrf string
			csrf, e = service.GetCSRF(r.Context(), refresh)
			if e == nil {
				if len(body) != 0 {
					e = identity.ErrInvalid
					break
				}
				json.NewEncoder(w).Encode(map[string]string{"csrf_token": csrf})
			}
		default:
			action := strings.TrimPrefix(r.URL.Path, "/api/v1/auth/")
			in := identity.Mutation{Action: action, Access: access, Refresh: refresh, Origin: single("Origin"), CSRF: single("X-CSRF-Token"), RequestID: rid}
			in.ClassID = func() (string, error) {
				var input struct {
					ClassID string `json:"class_id"`
				}
				e := decode(&input)
				return input.ClassID, e
			}
			// Empty body checks execute after auth within the mutation transaction.
			in.ValidateBody = func() error {
				if action != "switch-class" && len(body) != 0 {
					return identity.ErrInvalid
				}
				return nil
			}
			var out identity.Issued
			out, e = service.Mutate(r.Context(), in)
			if e == nil {
				if action == "logout" {
					setRefresh(w, "", true)
					w.WriteHeader(204)
				} else {
					setRefresh(w, out.Refresh, false)
					json.NewEncoder(w).Encode(out.Body)
				}
			}
		}
		if e != nil {
			writeIdentityError(w, e)
		}
	}))
}
func setRefresh(w http.ResponseWriter, value string, clear bool) {
	age := 604800
	if clear {
		age = -1
	}
	http.SetCookie(w, &http.Cookie{Name: "campus_refresh", Value: value, Path: "/api/v1/auth", HttpOnly: true, Secure: true, SameSite: http.SameSiteStrictMode, MaxAge: age})
}
func writeIdentityCode(w http.ResponseWriter, status int, code, message string) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": code, "message": message, "fields": []any{}, "details": nil}, "request_id": w.Header().Get("X-Request-ID")})
}
func writeIdentityError(w http.ResponseWriter, e error) {
	status, code, message := 503, "DEPENDENCY_UNAVAILABLE", "服务暂不可用"
	switch {
	case errors.Is(e, identity.ErrInvalid), errors.Is(e, strictjson.ErrInvalid):
		status, code, message = 400, "VALIDATION_ERROR", "请求格式错误"
	case errors.Is(e, strictjson.ErrTooLarge):
		status, code, message = 413, "PAYLOAD_TOO_LARGE", "请求过大"
	case errors.Is(e, identity.ErrUnauthenticated):
		status, code, message = 401, "UNAUTHENTICATED", "请重新登录"
	case errors.Is(e, identity.ErrForbidden):
		status, code, message = 403, "FORBIDDEN", "无权执行此操作"
	case errors.Is(e, identity.ErrNotFound):
		status, code, message = 404, "NOT_FOUND", "资源不存在"
	case errors.Is(e, identity.ErrConflict):
		status, code, message = 409, "CONFLICT", "状态冲突"
	case errors.Is(e, identity.ErrTimeout):
		status, code, message = 504, "UPSTREAM_TIMEOUT", "请求超时，请核对当前状态"
	}
	writeIdentityCode(w, status, code, message)
}
