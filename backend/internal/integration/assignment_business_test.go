//go:build integration

package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/httpserver"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

type atBusinessFixture struct {
	app, db *sql.DB
	repo    *mysqlstore.Store
	auth    *identity.Service
	service *assignments.Service
	server  *httptest.Server
	users   map[string]identity.Issued
	logs    bytes.Buffer
}

func atBusinessSetup(t *testing.T, n int) *atBusinessFixture {
	t.Helper()
	app, db, name := database(t, n)
	ctx := context.Background()
	if (migrations.Executor{DB: db, Database: name}).Up(ctx, migrations.Target) != nil || (&mysqlstore.Store{DB: db}).Initialize(ctx, seed(t), nil) != nil {
		t.Fatal("AT real business schema/seed")
	}
	f := &atBusinessFixture{app: app, db: db, repo: &mysqlstore.Store{DB: app}, users: map[string]identity.Issued{}}
	auth, e := identity.New(f.repo, nil, "https://campus.test")
	if e != nil {
		t.Fatal("AT auth assembly")
	}
	f.auth = auth
	for _, name := range []string{"teacher-a", "teacher-b", "student-a", "student-a2", "student-b"} {
		v, e := auth.Login(ctx, name, "test-only-"+name, strings.Repeat("a", 32))
		if e != nil {
			t.Fatal("AT five real sessions")
		}
		f.users[name] = v
	}
	f.service = &assignments.Service{Repo: f.repo, Limiter: assignments.NewLimiter(nil)}
	logger := slog.New(slog.NewJSONHandler(&f.logs, nil))
	base := httpserver.IdentityHandler(logger, auth, f.repo, config.Identity{}, identity.NewLimiter(nil))
	base = httpserver.MaterialsHandler(logger, auth, &materials.Service{Repo: f.repo}, "https://campus.test", materials.NewLimiter(nil), base)
	f.server = httptest.NewTLSServer(httpserver.AssignmentsHandler(logger, auth, f.service, "https://campus.test", base))
	t.Cleanup(f.server.Close)
	return f
}
func (f *atBusinessFixture) call(t *testing.T, method, path, user, key string, body []byte, want int) ([]byte, http.Header) {
	t.Helper()
	request, _ := http.NewRequest(method, f.server.URL+path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Request-ID", "untrusted")
	if user != "" {
		request.Header.Set("Authorization", "Bearer "+f.users[user].Body.AccessToken)
	}
	if key != "" {
		request.Header.Set("Idempotency-Key", key)
	}
	response, e := f.server.Client().Do(request)
	if e != nil {
		t.Fatal("AT trusted HTTPS transport")
	}
	defer response.Body.Close()
	raw, e := io.ReadAll(io.LimitReader(response.Body, 200000))
	if e != nil || response.StatusCode != want {
		t.Fatalf("AT %s %s status%d want%d", method, path, response.StatusCode, want)
	}
	if len(response.Header.Get("X-Request-ID")) != 32 || response.Header.Get("X-Request-ID") == "untrusted" || response.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("AT server identifier/cache boundary")
	}
	if want >= 400 && want != 405 {
		var result struct {
			ID string `json:"request_id"`
		}
		if json.Unmarshal(raw, &result) != nil || result.ID != response.Header.Get("X-Request-ID") {
			t.Fatal("AT Error/request identifier mismatch")
		}
	}
	return raw, response.Header
}
func atJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, e := json.Marshal(v)
	if e != nil {
		t.Fatal("AT fixture JSON")
	}
	return b
}
func (f *atBusinessFixture) create(t *testing.T, title string) assignments.Assignment {
	t.Helper()
	input := assignments.CreateInput{Title: title, Description: "AT original description", Deadline: time.Now().UTC().Add(time.Hour).Format(assignments.Timestamp)}
	b, _ := f.call(t, "POST", "/api/v1/assignments", "teacher-a", "", atJSON(t, input), 201)
	var a assignments.Assignment
	if json.Unmarshal(b, &a) != nil || a.Version != 1 || a.Title != title || a.ClassID != f.users["teacher-a"].Body.Principal.ClassID {
		t.Fatal("AT trusted creation fields")
	}
	return a
}
func (f *atBusinessFixture) submit(t *testing.T, a assignments.Assignment, user, key, answer string) assignments.Accepted {
	t.Helper()
	b, _ := f.call(t, "POST", "/api/v1/assignments/"+a.ID+"/submissions", user, key, atJSON(t, map[string]any{"answer": answer, "assignment_version": 1}), 202)
	var accepted assignments.Accepted
	if json.Unmarshal(b, &accepted) != nil || accepted.Status != "pending" || accepted.TaskID == "" || accepted.SubmissionID == "" {
		t.Fatal("AT original pending202 snapshot")
	}
	return accepted
}
func atCounts(t *testing.T, db *sql.DB) []int {
	t.Helper()
	out := []int{}
	for _, table := range atTables[1:] {
		out = append(out, count(t, db, table))
	}
	return out
}
func atSameCounts(t *testing.T, db *sql.DB, before []int) {
	t.Helper()
	if fmt.Sprint(atCounts(t, db)) != fmt.Sprint(before) {
		t.Fatal("AT rejected request wrote partial domain rows")
	}
}
func atErrorCode(t *testing.T, raw []byte, want string) {
	t.Helper()
	var v struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if json.Unmarshal(raw, &v) != nil || v.Error.Code != want {
		t.Fatal("AT wrong safe error code")
	}
}

func TestATRealHTTPAuthorizationInputsAndIdempotency(t *testing.T) {
	f := atBusinessSetup(t, 31)
	ctx := context.Background()
	t.Run("AT-SC02-empty-create-and-method-boundary", func(t *testing.T) {
		b, _ := f.call(t, "GET", "/api/v1/assignments", "student-a", "", nil, 200)
		var page assignments.Page[assignments.Assignment]
		if json.Unmarshal(b, &page) != nil || page.Items == nil || len(page.Items) != 0 || page.Total != 0 || page.Page != 1 || page.PageSize != 20 {
			t.Fatal("AT true empty page")
		}
		f.call(t, "POST", "/api/v1/assignments", "student-a", "", []byte(`{"class_id":"forged"}`), 403)
		f.call(t, "GET", "/api/v1/assignments", "", "", nil, 401)
		b, h := f.call(t, "DELETE", "/api/v1/assignments", "", "", nil, 405)
		if len(b) != 0 || h.Get("Allow") != "GET, POST" {
			t.Fatal("AT 405 body/Allow")
		}
		for _, body := range []string{`{"title":"t","description":"d","deadline":"2035-01-01T00:00:00.000Z","class_id":"2"}`, `{"title":"t","title":"other","description":"d","deadline":"2035-01-01T00:00:00.000Z"}`, `{"title":" ","description":"d","deadline":"2035-01-01T00:00:00.000Z"}`, `{"title":"t","description":"d","deadline":"2035-01-01T00:00:00Z"}`, `{"title":"\ud800","description":"d","deadline":"2035-01-01T00:00:00.000Z"}`} {
			f.call(t, "POST", "/api/v1/assignments", "teacher-a", "", []byte(body), 400)
		}
		if count(t, f.db, "assignments") != 0 {
			t.Fatal("AT invalid create persisted")
		}
	})
	a := f.create(t, "  课程𠮷作业  ")
	path := "/api/v1/assignments/" + a.ID
	accepted := f.submit(t, a, "student-a", strings.Repeat("a", 16), "AT private answer\n𠮷\u0000")
	t.Run("AT-SC03-resource-chain-and-own-only-pages", func(t *testing.T) {
		for _, resource := range []string{"/api/v1/submissions/" + accepted.SubmissionID, "/api/v1/tasks/" + accepted.TaskID} {
			f.call(t, "GET", resource, "student-a", "", nil, 200)
			f.call(t, "GET", resource, "teacher-a", "", nil, 200)
			for _, user := range []string{"student-a2", "student-b", "teacher-b"} {
				b, _ := f.call(t, "GET", resource, user, "", nil, 404)
				var out map[string]any
				json.Unmarshal(b, &out)
				out["request_id"] = "same"
				missing, _ := f.call(t, "GET", strings.Split(resource, "/")[0]+"/api/v1/"+strings.Split(resource, "/")[3]+"/9223372036854775807", user, "", nil, 404)
				var other map[string]any
				json.Unmarshal(missing, &other)
				other["request_id"] = "same"
				if !bytes.Equal(atJSON(t, out), atJSON(t, other)) {
					t.Fatal("AT private/external/missing404 differs")
				}
			}
		}
		for _, user := range []string{"student-b", "teacher-b"} {
			f.call(t, "GET", path, user, "", nil, 404)
		}
		f.call(t, "POST", "/api/v1/tasks/"+accepted.TaskID+"/cancel", "teacher-a", "", []byte(`{"version":1}`), 403)
		for _, user := range []string{"teacher-a", "student-a", "student-a2"} {
			b, _ := f.call(t, "GET", path+"/submissions", user, "", nil, 200)
			var out assignments.Page[assignments.Submission]
			if json.Unmarshal(b, &out) != nil {
				t.Fatal("sub page")
			}
			want := int64(1)
			if user == "student-a2" {
				want = 0
			}
			if out.Total != want || len(out.Items) != int(want) {
				t.Fatal("AT wrong private list scope")
			}
		}
		for _, query := range []string{"?page=0", "?page=1&page=2", "?page_size=51", "?class_id=2", "?page=2147483648"} {
			f.call(t, "GET", "/api/v1/assignments"+query, "student-a", "", nil, 400)
		}
		f.call(t, "GET", path+"?unknown=1", "student-a", "", nil, 400)
	})
	t.Run("AT-SC04-wire-codepoint-and-version-boundaries", func(t *testing.T) {
		f.service.Limiter = assignments.NewLimiter(nil)
		before := atCounts(t, f.db)
		for _, body := range []string{`{"answer":"","assignment_version":1}`, `{"answer":"x","assignment_version":"1"}`, `{"answer":"x","assignment_version":0}`, `{"answer":"x","assignment_version":1.001}`, `{"answer":"\udfff","assignment_version":1}`, `{"answer":"x","assignment_version":1,"student_id":"forged"}`, `{"answer":"x","assignment_version":1,"answer":"y"}`} {
			f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("b", 16), []byte(body), 400)
		}
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("b", 15), []byte(`{"answer":"x","assignment_version":1}`), 400)
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("b", 16), bytes.Repeat([]byte("x"), 65537), 413)
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("b", 16), atJSON(t, map[string]any{"answer": strings.Repeat("𠮷", 20000), "assignment_version": 1}), 413)
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("b", 16), atJSON(t, map[string]any{"answer": strings.Repeat("a", 20001), "assignment_version": 1}), 400)
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("b", 16), []byte(`{"answer":"x","assignment_version":1e9999999999999999999999999}`), 409)
		atSameCounts(t, f.db, before)
		base := atJSON(t, map[string]any{"answer": strings.Repeat("a", 20000), "assignment_version": 1})
		base = append(base, bytes.Repeat([]byte(" "), 65536-len(base))...)
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("c", 16), base, 202)
		f.submit(t, a, "student-a", strings.Repeat("d", 16), " \t\n ")
	})
	t.Run("AT-SC06-concurrent-same-key-and-canonical-json", func(t *testing.T) {
		f.service.Limiter = assignments.NewLimiter(nil)
		before := atCounts(t, f.db)
		var wg sync.WaitGroup
		results := make(chan assignments.Accepted, 20)
		errs := make(chan string, 20)
		for i := 0; i < 20; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				body := `{"answer":"并发𠮷\n","assignment_version":1}`
				if i%2 == 0 {
					body = `{"assignment_version":1.0,"answer":"\u5e76\u53d1\ud842\udfb7\n"}`
				}
				request, _ := http.NewRequest("POST", f.server.URL+path+"/submissions", strings.NewReader(body))
				request.Header.Set("Content-Type", "application/json")
				request.Header.Set("Authorization", "Bearer "+f.users["student-a"].Body.AccessToken)
				request.Header.Set("Idempotency-Key", strings.Repeat("e", 16))
				r, e := f.server.Client().Do(request)
				if e != nil {
					errs <- "transport"
					return
				}
				defer r.Body.Close()
				var out assignments.Accepted
				if r.StatusCode != 202 || json.NewDecoder(r.Body).Decode(&out) != nil {
					errs <- "not202"
					return
				}
				results <- out
			}(i)
		}
		wg.Wait()
		close(results)
		close(errs)
		for range errs {
			t.Fatal("AT same-key concurrent request failed")
		}
		var first assignments.Accepted
		for value := range results {
			if first.TaskID == "" {
				first = value
			}
			if value != first {
				t.Fatal("AT concurrent accepted snapshot differs")
			}
		}
		after := atCounts(t, f.db)
		for i, n := range before {
			if after[i] != n+1 {
				t.Fatal("AT duplicate submission/task/event/snapshot")
			}
		}
		b, _ := f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("e", 16), []byte(`{"assignment_version":1e0,"answer":"并发𠮷\n"}`), 202)
		var replay assignments.Accepted
		json.Unmarshal(b, &replay)
		if replay != first {
			t.Fatal("AT equivalent exponent digest changed")
		}
	})
	t.Run("AT-SC07-replay-before-time-quota-and-task-state", func(t *testing.T) {
		f.service.Limiter = assignments.NewLimiter(func() time.Time { return time.Unix(120, 0) })
		for i := 0; i < 12; i++ {
			f.service.Limiter.Allow(f.users["student-a"].Body.Principal.UserID)
		}
		f.repo.AssignmentClock = func(ctx context.Context, tx *sql.Tx) (time.Time, error) {
			var now time.Time
			e := tx.QueryRowContext(ctx, "SELECT deadline FROM assignments WHERE id=?", a.ID).Scan(&now)
			return now, e
		}
		defer func() { f.repo.AssignmentClock = nil }()
		b, h := f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("a", 16), []byte(`{"assignment_version":1.0,"answer":"AT private answer\n𠮷\u0000"}`), 202)
		var value assignments.Accepted
		json.Unmarshal(b, &value)
		if value != accepted {
			t.Fatal("AT deadline/quota changed original202")
		}
		if h.Get("X-Request-ID") == "" {
			t.Fatal("AT fresh replay identifier")
		}
		b, _ = f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("a", 16), []byte(`{"assignment_version":2,"answer":"changed"}`), 409)
		atErrorCode(t, b, "IDEMPOTENCY_CONFLICT")
		before := atCounts(t, f.db)
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("f", 16), []byte(`{"assignment_version":1,"answer":"new"}`), 409)
		atSameCounts(t, f.db, before)
		f.service.Limiter = assignments.NewLimiter(nil)
		taskPath := "/api/v1/tasks/" + accepted.TaskID
		b, _ = f.call(t, "POST", taskPath+"/cancel", "student-a", "", []byte(`{"version":1}`), 200)
		var task assignments.Task
		json.Unmarshal(b, &task)
		if task.Status != "cancelled" || task.Version != 2 || !task.CancelRequested {
			t.Fatal("AT pending cancel")
		}
		b, _ = f.call(t, "POST", taskPath+"/cancel", "student-a", "", []byte(`{"version":1}`), 409)
		atErrorCode(t, b, "TASK_TERMINAL")
		f.call(t, "POST", taskPath+"/retry", "student-a", "", []byte(`{"version":2}`), 409)
		b, _ = f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("a", 16), []byte(`{"assignment_version":1,"answer":"AT private answer\n𠮷\u0000"}`), 202)
		json.Unmarshal(b, &value)
		if value != accepted {
			t.Fatal("AT terminal task changed original pending202")
		}
		var state string
		if f.db.QueryRow("SELECT delivery_state FROM task_outbox WHERE task_id=?", accepted.TaskID).Scan(&state) != nil || state != "closed" {
			t.Fatal("AT pending cancel did not close same event")
		}
	})
	t.Run("AT-SC04-separate-quota-and-teacher-class-switch", func(t *testing.T) {
		f.service.Limiter = assignments.NewLimiter(func() time.Time { return time.Unix(120, 0) })
		principal := f.users["teacher-a"]
		for i := 0; i < 12; i++ {
			f.create(t, "quota"+strconv.Itoa(i))
		}
		body := atJSON(t, assignments.CreateInput{Title: "over quota", Description: "d", Deadline: time.Now().UTC().Add(time.Hour).Format(assignments.Timestamp)})
		_, h := f.call(t, "POST", "/api/v1/assignments", "teacher-a", "", body, 429)
		if h.Get("Retry-After") != "60" {
			t.Fatal("AT exact quota RetryAfter")
		}
		csrf, e := f.auth.GetCSRF(ctx, principal.Refresh)
		if e != nil {
			t.Fatal("csrf")
		}
		switched, e := f.auth.Mutate(ctx, identity.Mutation{Action: "switch-class", Access: principal.Body.AccessToken, Refresh: principal.Refresh, CSRF: csrf, Origin: "https://campus.test", RequestID: strings.Repeat("a", 32), ClassID: func() (string, error) { return f.users["teacher-b"].Body.Principal.ClassID, nil }})
		if e != nil {
			t.Fatal("teacher actual class switch")
		}
		f.users["teacher-a"] = switched
		f.call(t, "POST", "/api/v1/assignments", "teacher-a", "", body, 429)
		f.call(t, "GET", path, "teacher-a", "", nil, 404)
		// The independent04 limiter still accepts a real class-B upload.
		u, e := materials.PrepareUpload("AT quota source", "f.txt", []byte("AT independent source"))
		if e != nil {
			t.Fatal("04 input")
		}
		m, _, e := (&materials.Service{Repo: f.repo}).Create(ctx, switched.Body.Principal, "at_other_quota_01", u)
		if e != nil {
			t.Fatal("04 setup")
		}
		f.call(t, "POST", "/api/v1/materials/"+m.ID+"/retry-index", "teacher-a", "", nil, 200)
	})
	t.Run("AT-SC08-session-revocation-before-replay", func(t *testing.T) {
		user := f.users["student-a"]
		csrf, e := f.auth.GetCSRF(ctx, user.Refresh)
		if e != nil {
			t.Fatal("csrf")
		}
		if _, e = f.auth.Mutate(ctx, identity.Mutation{Action: "logout", Access: user.Body.AccessToken, Refresh: user.Refresh, CSRF: csrf, Origin: "https://campus.test", RequestID: strings.Repeat("b", 32)}); e != nil {
			t.Fatal("logout")
		}
		before := atCounts(t, f.db)
		f.call(t, "POST", path+"/submissions", "student-a", strings.Repeat("a", 16), []byte(`{"answer":"AT private answer\n𠮷\u0000","assignment_version":1}`), 401)
		atSameCounts(t, f.db, before)
	})
	for _, secret := range []string{"AT private answer", strings.Repeat("a", 16), "test-only-student-a", f.users["student-a"].Body.AccessToken} {
		if strings.Contains(f.logs.String(), secret) {
			t.Fatal("AT sensitive value in HTTP logs")
		}
	}
	t.Log("AT-SC-02..08 actual MySQL/HTTPS authorization, inputs, concurrent atomic snapshots, deadline/quota precedence and session revocation passed")
}

func TestATBusinessWritePointRollbackAndControlledDeadline(t *testing.T) {
	f := atBusinessSetup(t, 32)
	ctx := context.Background()
	a := f.create(t, "rollback")
	for step := 1; step <= 4; step++ {
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "submit" && n == step {
				return errors.New("AT controlled transaction failure")
			}
			return nil
		}
		before := atCounts(t, f.db)
		f.call(t, "POST", "/api/v1/assignments/"+a.ID+"/submissions", "student-a", strings.Repeat("g", 16), []byte(`{"answer":"rollback","assignment_version":1}`), 503)
		atSameCounts(t, f.db, before)
	}
	f.repo.AssignmentHook = nil
	f.submit(t, a, "student-a", strings.Repeat("g", 16), "rollback")
	// All time comparison uses the same real transaction. The fixture returns a
	// database DATETIME at the exact deadline, not a timing sleep/race.
	f.repo.AssignmentClock = func(ctx context.Context, tx *sql.Tx) (time.Time, error) {
		var at time.Time
		e := tx.QueryRowContext(ctx, "SELECT deadline FROM assignments WHERE id=?", a.ID).Scan(&at)
		return at, e
	}
	before := atCounts(t, f.db)
	f.call(t, "POST", "/api/v1/assignments/"+a.ID+"/submissions", "student-a", strings.Repeat("h", 16), []byte(`{"answer":"equal deadline","assignment_version":1}`), 409)
	atSameCounts(t, f.db, before)
	f.repo.AssignmentClock = nil
	bounded, cancel := context.WithTimeout(ctx, 150*time.Millisecond)
	defer cancel()
	f.repo.AssignmentHook = func(stage string, step int) error {
		if stage == "submit" && step == 2 {
			_, e := f.app.ExecContext(bounded, "SELECT SLEEP(2)")
			return e
		}
		return nil
	}
	_, e := f.service.Submit(bounded, f.users["student-a"].Body.Principal, a.ID, strings.Repeat("i", 16), assignments.SubmitInput{Answer: "timeout", Version: assignments.Version{Value: 1}})
	if !errors.Is(e, identity.ErrTimeout) {
		t.Fatal("AT timed write did not surface504")
	}
	atSameCounts(t, f.db, before)
	f.repo.AssignmentHook = nil
}

func TestATMutationStatesAndRollback(t *testing.T) {
	f := atBusinessSetup(t, 35)
	a := f.create(t, "task actions")
	accepted := f.submit(t, a, "student-a", strings.Repeat("j", 16), "task fixture")
	path := "/api/v1/tasks/" + accepted.TaskID
	original := func() assignments.Task {
		b, _ := f.call(t, "GET", path, "student-a", "", nil, 200)
		var task assignments.Task
		json.Unmarshal(b, &task)
		return task
	}
	initial := original()
	for step := 1; step <= 2; step++ {
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "change-task" && n == step {
				return errors.New("AT controlled action failure")
			}
			return nil
		}
		f.call(t, "POST", path+"/cancel", "student-a", "", []byte(`{"version":1}`), 503)
		if original() != initial {
			t.Fatal("AT partial cancel transaction")
		}
		var status string
		f.db.QueryRow("SELECT delivery_state FROM task_outbox WHERE task_id=?", accepted.TaskID).Scan(&status)
		if status != "pending" {
			t.Fatal("AT half closed event")
		}
	}
	f.repo.AssignmentHook = nil
	// Test-only SQL seeds legal failed/running snapshots to exercise the HTTP
	// action rules. This is not a worker, claim or real grading result.
	atExec(t, f.db, "UPDATE tasks SET status='failed',attempt=1,execution_epoch=1,version=3,error_code='EXECUTION_FAILED' WHERE id=?", accepted.TaskID)
	atExec(t, f.db, "UPDATE task_outbox SET delivery_state='closed' WHERE task_id=?", accepted.TaskID)
	for step := 1; step <= 2; step++ {
		f.repo.AssignmentHook = func(stage string, n int) error {
			if stage == "change-task" && n == step {
				return errors.New("AT controlled retry failure")
			}
			return nil
		}
		f.call(t, "POST", path+"/retry", "student-a", "", []byte(`{"version":3}`), 503)
		task := original()
		if task.Status != "failed" || task.Version != 3 || task.Attempt != 1 {
			t.Fatal("AT partial retry")
		}
	}
	f.repo.AssignmentHook = nil
	b, _ := f.call(t, "POST", path+"/retry", "student-a", "", []byte(`{"version":3.0}`), 200)
	var task assignments.Task
	json.Unmarshal(b, &task)
	if task.Status != "pending" || task.Version != 4 || task.Attempt != 1 || task.Epoch != 1 || task.Error != nil {
		t.Fatal("AT retry reset counts/answer")
	}
	f.call(t, "POST", path+"/retry", "student-a", "", []byte(`{"version":3}`), 409)
	atExec(t, f.db, "UPDATE tasks SET status='running',attempt=2,execution_epoch=2,version=5,worker_owner=?,lease_until=UTC_TIMESTAMP(3)+INTERVAL 60 SECOND WHERE id=?", strings.Repeat("a", 32), accepted.TaskID)
	atExec(t, f.db, "UPDATE task_outbox SET delivery_state='leased' WHERE task_id=?", accepted.TaskID)
	b, _ = f.call(t, "POST", path+"/cancel", "student-a", "", []byte(`{"version":5}`), 200)
	json.Unmarshal(b, &task)
	if task.Status != "running" || !task.CancelRequested || task.Version != 6 {
		t.Fatal("AT running cancel lied about termination")
	}
	b, _ = f.call(t, "POST", path+"/cancel", "student-a", "", []byte(`{"version":6}`), 200)
	var repeated assignments.Task
	json.Unmarshal(b, &repeated)
	if repeated.Version != task.Version || repeated.UpdatedAt != task.UpdatedAt {
		t.Fatal("AT repeat cancellation mutated public version")
	}
	f.call(t, "POST", path+"/cancel", "student-a", "", []byte(`{"version":5}`), 409)
	atExec(t, f.db, "UPDATE tasks SET status='failed',attempt=3,execution_epoch=3,version=7,cancel_requested=0,error_code='RETRY_EXHAUSTED',worker_owner=NULL,lease_until=NULL WHERE id=?", accepted.TaskID)
	atExec(t, f.db, "UPDATE task_outbox SET delivery_state='closed' WHERE task_id=?", accepted.TaskID)
	b, _ = f.call(t, "POST", path+"/retry", "student-a", "", []byte(`{"version":6}`), 409)
	atErrorCode(t, b, "CONFLICT")
	b, _ = f.call(t, "POST", path+"/retry", "student-a", "", []byte(`{"version":7}`), 409)
	atErrorCode(t, b, "RETRY_EXHAUSTED")
	b, _ = f.call(t, "POST", path+"/cancel", "student-a", "", []byte(`{"version":1}`), 409)
	atErrorCode(t, b, "TASK_TERMINAL")
	if count(t, f.db, "tasks") != 1 || count(t, f.db, "task_outbox") != 1 {
		t.Fatal("AT actions manufactured new task/event")
	}
	// A damaged persisted snapshot must fail closed with the same safe 503,
	// rather than expose an impossible public Task or accept an action on it.
	atExec(t, f.db, "UPDATE tasks SET version=1 WHERE id=?", accepted.TaskID)
	f.call(t, "GET", path, "student-a", "", nil, 503)
	atExec(t, f.db, "UPDATE tasks SET version=7,updated_at=created_at-INTERVAL 1 SECOND WHERE id=?", accepted.TaskID)
	f.call(t, "GET", path, "student-a", "", nil, 503)
}
func TestATConsistentPageSnapshotsAndExactIDs(t *testing.T) {
	f := atBusinessSetup(t, 33)
	a := f.create(t, "page1")
	f.create(t, "page2")
	ctx := context.Background()
	p := f.users["teacher-a"].Body.Principal
	// An independently committed insert after COUNT must not enter this page.
	fresh := &mysqlstore.Store{DB: f.app}
	f.repo.AssignmentHook = func(stage string, _ int) error {
		if stage == "list-assignments-count" {
			// Use an independent fixture transaction: the production read holds
			// the teacher/session shared locks, so creating as that same teacher
			// would wait for the outer read rather than test the data snapshot.
			_, e := f.app.ExecContext(ctx, "INSERT INTO assignments(class_id,teacher_id,title,description,deadline,version,created_at) VALUES(?,?,'after count','d',UTC_TIMESTAMP(3)+INTERVAL 1 HOUR,1,UTC_TIMESTAMP(3))", p.ClassID, p.UserID)
			return e
		}
		return nil
	}
	page, e := f.repo.ListAssignments(ctx, p, 1, 50)
	f.repo.AssignmentHook = nil
	if e != nil || page.Total != 2 || len(page.Items) != 2 || count(t, f.db, "assignments") != 3 {
		t.Fatal("AT assignment count/page snapshot split")
	}
	// Resource IDs remain decimal strings and sort exactly beyond JS safe integers.
	atExec(t, f.db, "INSERT INTO assignments(id,class_id,teacher_id,title,description,deadline,version,created_at) VALUES(9007199254740993,?,?,'large one','d',UTC_TIMESTAMP(3)+INTERVAL 1 DAY,1,'2030-01-01 00:00:00.000'),(9007199254740994,?,?,'large two','d',UTC_TIMESTAMP(3)+INTERVAL 1 DAY,1,'2030-01-01 00:00:00.000')", p.ClassID, p.UserID, p.ClassID, p.UserID)
	page, e = f.repo.ListAssignments(ctx, p, 1, 2)
	if e != nil || page.Items[0].ID != "9007199254740994" || page.Items[1].ID != "9007199254740993" {
		t.Fatal("AT stable created/id ordering lost integer precision")
	}
	f.submit(t, a, "student-a", strings.Repeat("k", 16), "before count")
	f.repo.AssignmentHook = func(stage string, _ int) error {
		if stage == "list-submissions-count" {
			_, e := fresh.SubmitAssignment(ctx, f.users["student-a2"].Body.Principal, a.ID, strings.Repeat("l", 16), assignments.SubmitInput{Answer: "after count", Version: assignments.Version{Value: 1}}, func() error { return nil })
			return e
		}
		return nil
	}
	subs, e := f.repo.ListSubmissions(ctx, p, a.ID, 1, 50)
	f.repo.AssignmentHook = nil
	if e != nil || subs.Total != 1 || len(subs.Items) != 1 || count(t, f.db, "submissions") != 2 {
		t.Fatal("AT authorized submission count/page snapshot split")
	}
}
