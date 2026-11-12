package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/strictjson"
)

func assignmentRoute(path string) (kind, id, methods string) {
	if path == "/api/v1/assignments" {
		return "assignments", "", "GET, POST"
	}
	for _, prefix := range []string{"/api/v1/assignments/", "/api/v1/submissions/", "/api/v1/tasks/"} {
		if !strings.HasPrefix(path, prefix) {
			continue
		}
		parts := strings.Split(strings.TrimPrefix(path, prefix), "/")
		if parts[0] == "" {
			return
		}
		if prefix == "/api/v1/assignments/" {
			if len(parts) == 1 {
				return "assignment", parts[0], "GET"
			}
			if len(parts) == 2 && parts[1] == "submissions" {
				return "submissions", parts[0], "GET, POST"
			}
		}
		if prefix == "/api/v1/submissions/" && len(parts) == 1 {
			return "submission", parts[0], "GET"
		}
		if prefix == "/api/v1/tasks/" {
			if len(parts) == 1 {
				return "task", parts[0], "GET"
			}
			if len(parts) == 2 && (parts[1] == "retry" || parts[1] == "cancel") {
				return parts[1], parts[0], "POST"
			}
		}
	}
	return
}

// The same handler is used by production and the real-MySQL integration tests.
// It only adds the nine approved AT operations, never a fake grading endpoint.
func AssignmentsHandler(logger *slog.Logger, auth materialAuthenticator, service *assignments.Service, origin string, fallback http.Handler) http.Handler {
	business := Observe(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		kind, id, methods := assignmentRoute(r.URL.Path)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if !strings.Contains(","+strings.ReplaceAll(methods, " ", "")+",", ","+r.Method+",") {
			w.Header().Set("Allow", methods)
			w.WriteHeader(405)
			return
		}
		fail := func(e error) {
			var rate *assignments.RateError
			switch {
			case errors.As(e, &rate):
				w.Header().Set("Retry-After", strconv.Itoa(max(1, rate.Seconds)))
				writeIdentityCode(w, 429, "RATE_LIMITED", "请稍后重试")
			case errors.Is(e, assignments.ErrIdempotencyConflict):
				writeIdentityCode(w, 409, "IDEMPOTENCY_CONFLICT", "提交内容与已受理记录不一致")
			case errors.Is(e, assignments.ErrRetryExhausted):
				writeIdentityCode(w, 409, "RETRY_EXHAUSTED", "重试次数已用尽")
			case errors.Is(e, assignments.ErrTaskTerminal):
				writeIdentityCode(w, 409, "TASK_TERMINAL", "任务已结束")
			default:
				writeIdentityError(w, e)
			}
		}
		if r.ContentLength > 65536 {
			fail(strictjson.ErrTooLarge)
			return
		}
		body, e := strictjson.Read(r.Body)
		if e != nil {
			fail(e)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		access := ""
		headers := r.Header.Values("Authorization")
		if len(headers) == 1 && strings.HasPrefix(headers[0], "Bearer ") {
			access = strings.TrimPrefix(headers[0], "Bearer ")
		}
		p, e := auth.Me(ctx, access)
		if e != nil {
			fail(e)
			return
		}
		if e = assignments.Readable(p); e != nil {
			fail(e)
			return
		}
		if r.Method == "POST" {
			role := "student"
			if kind == "assignments" {
				role = "teacher"
			}
			if e = assignments.Action(p, role); e != nil {
				fail(e)
				return
			}
			origins := r.Header.Values("Origin")
			if len(origins) > 1 || (len(origins) == 1 && origins[0] != origin) {
				fail(identity.ErrForbidden)
				return
			}
		}
		var resource any
		if id != "" {
			if !assignments.ValidID(id) {
				fail(identity.ErrInvalid)
				return
			}
			switch kind {
			case "assignment", "submissions":
				resource, e = service.Repo.GetAssignment(ctx, p, id)
			case "submission":
				resource, e = service.Repo.GetSubmission(ctx, p, id)
			default:
				resource, e = service.Repo.GetTask(ctx, p, id)
			}
			if e != nil {
				fail(e)
				return
			}
		}
		list := r.Method == "GET" && (kind == "assignments" || kind == "submissions")
		var page, size int
		if list {
			q, err := queryValues(r, "page", "page_size")
			if err != nil {
				fail(err)
				return
			}
			page, e = integerQuery(q, "page", 1, 2147483647)
			if e != nil {
				fail(e)
				return
			}
			size, e = integerQuery(q, "page_size", 20, 50)
			if e != nil {
				fail(e)
				return
			}
		} else if _, e = queryValues(r); e != nil {
			fail(e)
			return
		}
		if r.Method == "GET" {
			if len(body) != 0 {
				fail(identity.ErrInvalid)
				return
			}
			if list {
				if kind == "assignments" {
					resource, e = service.Repo.ListAssignments(ctx, p, page, size)
				} else {
					resource, e = service.Repo.ListSubmissions(ctx, p, id, page, size)
				}
			}
			if e != nil {
				fail(e)
				return
			}
			json.NewEncoder(w).Encode(resource)
			return
		}
		media, _, e := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if e != nil || media != "application/json" {
			fail(identity.ErrInvalid)
			return
		}
		switch kind {
		case "assignments":
			var input assignments.CreateInput
			if strictjson.Decode(body, &input) != nil {
				fail(identity.ErrInvalid)
				return
			}
			out, err := service.Create(ctx, p, input)
			if err != nil {
				fail(err)
				return
			}
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(out)
		case "submissions":
			var input struct {
				Answer  string          `json:"answer"`
				Version json.RawMessage `json:"assignment_version"`
			}
			if strictjson.Decode(body, &input) != nil {
				fail(identity.ErrInvalid)
				return
			}
			v, err := assignments.PositiveVersion(input.Version)
			if err != nil {
				fail(err)
				return
			}
			keys := r.Header.Values("Idempotency-Key")
			if len(keys) != 1 || !assignments.ValidKey(keys[0]) {
				fail(identity.ErrInvalid)
				return
			}
			out, err := service.Submit(ctx, p, id, keys[0], assignments.SubmitInput{Answer: input.Answer, Version: v})
			if err != nil {
				fail(err)
				return
			}
			w.WriteHeader(202)
			json.NewEncoder(w).Encode(out)
		case "retry", "cancel":
			var input struct {
				Version json.RawMessage `json:"version"`
			}
			if strictjson.Decode(body, &input) != nil {
				fail(identity.ErrInvalid)
				return
			}
			v, err := assignments.PositiveVersion(input.Version)
			if err != nil {
				fail(err)
				return
			}
			out, err := service.Change(ctx, p, id, kind, v)
			if err != nil {
				fail(err)
				return
			}
			json.NewEncoder(w).Encode(out)
		}
	}))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if kind, _, _ := assignmentRoute(r.URL.Path); kind == "" {
			fallback.ServeHTTP(w, r)
		} else {
			business.ServeHTTP(w, r)
		}
	})
}
