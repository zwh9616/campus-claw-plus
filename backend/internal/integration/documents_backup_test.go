//go:build integration && dibackup

package integration

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

type diRecovery struct {
	TeacherToken string
	AssignmentID string
	Accepted     assignments.Accepted
	MaterialID   string
	MaterialSHA  string
	SessionCount int
	ChecksumRows int
}

func diEnvironment(schema string) []string {
	var env []string
	for _, pair := range os.Environ() {
		if strings.HasPrefix(pair, "MYSQL_DSN=") || strings.HasPrefix(pair, "MYSQL_MIGRATION_DSN=") {
			pair = strings.Replace(pair, "/idf_test_0?", "/"+schema+"?", 1)
		}
		env = append(env, pair)
	}
	return append(env, "HTTP_PORT=18081", "AUTH_TRUSTED_ORIGIN=https://campus.test", "AUTH_TRUSTED_PROXY_CIDRS=127.0.0.1/32")
}
func diAdmin(t *testing.T, binary, schema string, success bool, args ...string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/fixtures/"+binary, args...)
	cmd.Env = diEnvironment(schema)
	cmd.Stdout, cmd.Stderr = io.Discard, io.Discard
	e := cmd.Run()
	if ctx.Err() != nil || (e == nil) != success {
		t.Fatal("actual artifact matrix", binary)
	}
}
func diStart(t *testing.T, binary, schema string) func() {
	t.Helper()
	cmd := exec.Command("/fixtures/" + binary)
	cmd.Env = diEnvironment(schema)
	cmd.Stdout, cmd.Stderr = io.Discard, io.Discard
	if cmd.Start() != nil {
		t.Fatal("start actual artifact")
	}
	stopped := false
	stop := func() {
		if !stopped {
			stopped = true
			cmd.Process.Kill()
			cmd.Wait()
		}
	}
	t.Cleanup(stop)
	client := &http.Client{Timeout: time.Second}
	defer client.CloseIdleConnections()
	for i := 0; i < 40; i++ {
		r, e := client.Get("http://127.0.0.1:18081/health")
		if e == nil {
			r.Body.Close()
			if r.StatusCode == 200 {
				return stop
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	stop()
	t.Fatal("actual artifact readiness")
	return stop
}
func diHTTP(t *testing.T, client *http.Client, method, path, token, key string, body []byte, want int) []byte {
	t.Helper()
	r, _ := http.NewRequest(method, "http://127.0.0.1:18081"+path, bytes.NewReader(body))
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	if key != "" {
		r.Header.Set("Idempotency-Key", key)
	}
	if body != nil {
		r.Header.Set("Content-Type", "application/json")
	}
	res, e := client.Do(r)
	if e != nil {
		t.Fatal("actual restored HTTP transport")
	}
	defer res.Body.Close()
	b, e := io.ReadAll(res.Body)
	if e != nil || res.StatusCode != want {
		t.Fatal("actual restored HTTP status", res.StatusCode, want)
	}
	return b
}

func TestDIBackupRestoreAndActualFiveSixMatrix(t *testing.T) {
	ctx := context.Background()
	stage := os.Getenv("DI_BACKUP_STAGE")
	app, original, name := database(t, 63)
	e := migrations.Executor{DB: original, Database: name}
	statePath := "/fixtures/di-recovery-state.json"
	if stage == "prepare" {
		p, m := atSeedV4(t, app, original, name)
		if e.Up(ctx, 5) != nil {
			t.Fatal("prepare5")
		}
		repo := &mysqlstore.Store{DB: app}
		auth, err := identity.New(repo, nil, "https://campus.test")
		if err != nil {
			t.Fatal(err)
		}
		teacher, err := auth.Login(ctx, "teacher-a", "test-only-teacher-a", strings.Repeat("a", 32))
		if err != nil {
			t.Fatal("teacher")
		}
		student, err := auth.Login(ctx, "student-a", "test-only-student-a", strings.Repeat("b", 32))
		if err != nil {
			t.Fatal("student")
		}
		service := &assignments.Service{Repo: repo, Limiter: assignments.NewLimiter(nil)}
		a, err := service.Create(ctx, teacher.Body.Principal, assignments.CreateInput{Title: "DI recovery pending", Description: "preserved assignment", Deadline: time.Now().UTC().Add(time.Hour).Format(assignments.Timestamp)})
		if err != nil {
			t.Fatal("assignment")
		}
		accepted, err := service.Submit(ctx, student.Body.Principal, a.ID, "di_recovery_original_01", assignments.SubmitInput{Answer: "DI preserved answer", Version: assignments.Version{Value: 1}})
		if err != nil || accepted.Status != "pending" {
			t.Fatal("original pending202")
		}
		raw, err := repo.GetMaterial(ctx, p, m.ID)
		if err != nil {
			t.Fatal("original material")
		}
		sum := sha256.Sum256(raw.Raw)
		s := diRecovery{teacher.Body.AccessToken, a.ID, accepted, m.ID, hex.EncodeToString(sum[:]), count(t, original, "sessions"), count(t, original, "identity_migration_checksums")}
		data, _ := json.Marshal(s)
		if os.WriteFile(statePath, data, 0600) != nil {
			t.Fatal("private recovery state")
		}
		diAdmin(t, "pre06-admin", name, true, "check")
		// Start and actually stop the accepted5 writer before the harness dumps.
		stop := diStart(t, "pre06-server", name)
		stop()
		client := &http.Client{Timeout: 300 * time.Millisecond}
		defer client.CloseIdleConnections()
		if r, err := client.Get("http://127.0.0.1:18081/health"); err == nil {
			r.Body.Close()
			t.Fatal("source writer still reachable before backup")
		}
		return
	}
	var saved diRecovery
	data, err := os.ReadFile(statePath)
	if err != nil || json.Unmarshal(data, &saved) != nil {
		t.Fatal("private recovery state missing")
	}
	if stage == "interrupt" {
		e.AfterDDL = func(v, n int) error {
			if v == 6 && n == 3 {
				return errors.New("deliberate upgrade interruption")
			}
			return nil
		}
		if e.Up(ctx, 6) == nil || e.Check(ctx, 6) == nil {
			t.Fatal("interrupted upgrade unexpectedly clean")
		}
		var version int
		var dirty bool
		if original.QueryRow("SELECT version,dirty FROM schema_migrations").Scan(&version, &dirty) != nil || version != 6 || !dirty {
			t.Fatal("failed6 was not preserved")
		}
		diAdmin(t, "pre06-admin", name, false, "check")
		diAdmin(t, "pre06-server", name, false)
		return
	}
	if stage != "verify" {
		t.Fatal("unknown backup stage")
	}
	_, restored, restoreName := database(t, 64)
	r := migrations.Executor{DB: restored, Database: restoreName}
	if r.Check(ctx, 5) != nil || count(t, restored, "users") != 5 || count(t, restored, "classes") != 2 || count(t, restored, "sessions") != saved.SessionCount || count(t, restored, "identity_migration_checksums") != saved.ChecksumRows {
		t.Fatal("restored5 identity/session/history drift")
	}
	var dirty bool
	if original.QueryRow("SELECT dirty FROM schema_migrations").Scan(&dirty) != nil || !dirty {
		t.Fatal("source failed6 destroyed during isolated restore")
	}
	diAdmin(t, "pre06-admin", restoreName, true, "check")
	diAdmin(t, "identity-admin", restoreName, false, "check")
	diAdmin(t, "server", restoreName, false)
	stop := diStart(t, "pre06-server", restoreName)
	client := &http.Client{Timeout: 3 * time.Second}
	defer client.CloseIdleConnections()
	diHTTP(t, client, "GET", "/api/v1/me", saved.TeacherToken, "", nil, 200)
	for _, user := range []string{"teacher-a", "teacher-b", "student-a", "student-a2", "student-b"} {
		request, _ := json.Marshal(map[string]string{"username": user, "password": "test-only-" + user})
		b := diHTTP(t, client, "POST", "/api/v1/auth/login", "", "", request, 200)
		var issued struct {
			Token string `json:"access_token"`
		}
		if json.Unmarshal(b, &issued) != nil || issued.Token == "" {
			t.Fatal("restored five identities")
		}
		if user == "teacher-a" {
			originalBytes := diHTTP(t, client, "GET", "/api/v1/materials/"+saved.MaterialID+"/download", issued.Token, "", nil, 200)
			sum := sha256.Sum256(originalBytes)
			if hex.EncodeToString(sum[:]) != saved.MaterialSHA {
				t.Fatal("original TXT bytes changed")
			}
		}
		if user == "student-a" {
			body := diHTTP(t, client, "GET", "/api/v1/tasks/"+saved.Accepted.TaskID, issued.Token, "", nil, 200)
			var task assignments.Task
			if json.Unmarshal(body, &task) != nil || task.Status != "pending" || task.Attempt != 0 {
				t.Fatal("restored task not original pending")
			}
			replay := diHTTP(t, client, "POST", "/api/v1/assignments/"+saved.AssignmentID+"/submissions", issued.Token, "di_recovery_original_01", []byte(`{"answer":"DI preserved answer","assignment_version":1}`), 202)
			var accepted assignments.Accepted
			if json.Unmarshal(replay, &accepted) != nil || accepted != saved.Accepted {
				t.Fatal("restored original202 replay changed")
			}
		}
	}
	stop()
	// Forward repair keeps the failed6 database as a separate preserved source;
	// isolated5 remains on the exact accepted old artifact and unchanged schema.
	if e.Repair(ctx, 6) != nil || e.Check(ctx, 6) != nil || r.Check(ctx, 5) != nil {
		t.Fatal("forward repair or restored isolation")
	}
	diAdmin(t, "pre06-admin", name, false, "check")
	diAdmin(t, "pre06-server", name, false)
	diAdmin(t, "identity-admin", name, true, "check")
	newStop := diStart(t, "server", name)
	diHTTP(t, client, "GET", "/api/v1/me", saved.TeacherToken, "", nil, 200)
	newStop()
	var class, user uint64
	if original.QueryRow("SELECT class_id,user_id FROM sessions WHERE id=(SELECT id FROM sessions ORDER BY id LIMIT 1)").Scan(&class, &user) != nil {
		t.Fatal("source identity")
	}
	result := atExec(t, original, "INSERT INTO documents(class_id,created_by,title,format,version,status,original_bytes,original_digest,size_bytes,attempts,created_at,updated_at) VALUES(?,?,'post-backup data','pdf',1,'queued','%PDF-after-backup',UNHEX(SHA2('%PDF-after-backup',256)),17,0,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", class, user)
	if _, err := result.LastInsertId(); err != nil {
		t.Fatal("new6 original bytes")
	}
	if e.Check(ctx, 6) != nil || r.Check(ctx, 5) != nil || count(t, original, "documents") != 1 {
		t.Fatal("preserved6 source changed")
	}
	var docTables int
	if restored.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=? AND table_name='documents'", restoreName).Scan(&docTables) != nil || docTables != 0 {
		t.Fatal("backup falsely contains post-backup6 writes")
	}
	if count(t, original, "tasks") != 1 || count(t, restored, "tasks") != 1 || count(t, original, "submission_idempotency") != 1 || count(t, restored, "submission_idempotency") != 1 {
		t.Fatal("pending/idempotency data boundary")
	}
	t.Log("DI-SC-15 real stopped5 dump, interrupted6 preserved, isolated5 recovery, actual5/6 rejection matrix, five identities/saved session/TXT/pending/original202, forward repair and post-backup boundary passed")
}
