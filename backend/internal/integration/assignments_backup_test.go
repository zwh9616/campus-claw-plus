//go:build integration && atbackup

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

// The harness performs a real mysqldump and isolated restore between phases.
// Old binaries come from the exact accepted pre-05 Git commit, not a mock.
func TestATBackupRestoreAndActualTargetMatrix(t *testing.T) {
	stage := os.Getenv("AT_BACKUP_STAGE")
	ctx := context.Background()
	_, original, name := database(t, 28)
	ex := migrations.Executor{DB: original, Database: name}
	if stage == "prepare" {
		app, _, _ := database(t, 28)
		atSeedV4(t, app, original, name)
		return
	}
	if stage != "verify" {
		t.Fatal("unknown backup stage")
	}
	if ex.Up(ctx, 5) != nil {
		t.Fatal("upgrade source to5")
	}
	runOld := func(binary, schema string, wantSuccess bool, args ...string) {
		t.Helper()
		bounded, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		cmd := exec.CommandContext(bounded, "/fixtures/"+binary, args...)
		for _, pair := range os.Environ() {
			if strings.HasPrefix(pair, "MYSQL_DSN=") || strings.HasPrefix(pair, "MYSQL_MIGRATION_DSN=") {
				pair = strings.Replace(pair, "/idf_test_0?", "/"+schema+"?", 1)
			}
			cmd.Env = append(cmd.Env, pair)
		}
		cmd.Env = append(cmd.Env, "HTTP_PORT=18080", "AUTH_TRUSTED_ORIGIN=https://campus.test", "AUTH_TRUSTED_PROXY_CIDRS=127.0.0.1/32")
		cmd.Stdout, cmd.Stderr = io.Discard, io.Discard
		err := cmd.Run()
		if bounded.Err() != nil || (err == nil) != wantSuccess {
			t.Fatal("old artifact did not enforce exact migration target", binary)
		}
	}
	runOld("pre05-server", name, false)
	runOld("pre05-admin", name, false, "check")
	app, restored, restoredName := database(t, 29)
	if (migrations.Executor{DB: restored, Database: restoredName}).Check(ctx, 4) != nil || count(t, restored, "users") != 5 || count(t, restored, "classes") != 2 {
		t.Fatal("isolated4 dump restore lost identity/history")
	}
	runOld("pre05-admin", restoredName, true, "check")
	runOld("identity-admin", restoredName, false, "check")
	runOld("identity-admin", restoredName, false, "initialize")
	runOld("server", restoredName, false)
	runOld("identity-admin", name, true, "check")
	// Prove the same server/config can actually start against the restored v4
	// database. Otherwise a missing configuration could falsely pass rejection.
	oldServer := exec.Command("/fixtures/pre05-server")
	for _, pair := range os.Environ() {
		if strings.HasPrefix(pair, "MYSQL_DSN=") {
			pair = strings.Replace(pair, "/idf_test_0?", "/"+restoredName+"?", 1)
		}
		oldServer.Env = append(oldServer.Env, pair)
	}
	oldServer.Env = append(oldServer.Env, "HTTP_PORT=18080", "AUTH_TRUSTED_ORIGIN=https://campus.test", "AUTH_TRUSTED_PROXY_CIDRS=127.0.0.1/32")
	oldServer.Stdout, oldServer.Stderr = io.Discard, io.Discard
	if oldServer.Start() != nil {
		t.Fatal("start actual old artifact")
	}
	defer func() { oldServer.Process.Kill(); oldServer.Wait() }()
	client := &http.Client{Timeout: time.Second}
	defer client.CloseIdleConnections()
	ready := false
	for i := 0; i < 30; i++ {
		res, err := client.Get("http://127.0.0.1:18080/health")
		if err == nil {
			res.Body.Close()
			if res.StatusCode == 200 {
				ready = true
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !ready {
		t.Fatal("actual old server failed restored v4 readiness")
	}
	for _, user := range []string{"teacher-a", "teacher-b", "student-a", "student-a2", "student-b"} {
		data, _ := json.Marshal(map[string]string{"username": user, "password": "test-only-" + user})
		res, err := client.Post("http://127.0.0.1:18080/api/v1/auth/login", "application/json", bytes.NewReader(data))
		if err != nil {
			t.Fatal("old artifact restored login")
		}
		var response struct {
			Access string `json:"access_token"`
		}
		decodeErr := json.NewDecoder(res.Body).Decode(&response)
		res.Body.Close()
		if decodeErr != nil || response.Access == "" {
			t.Fatal("old restored login response")
		}
		if user == "teacher-a" {
			var id string
			if restored.QueryRow("SELECT id FROM materials WHERE title='AT backup source'").Scan(&id) != nil {
				t.Fatal("restored material missing")
			}
			request, _ := http.NewRequest("GET", "http://127.0.0.1:18080/api/v1/materials/"+id+"/download", nil)
			request.Header.Set("Authorization", "Bearer "+response.Access)
			doc, err := client.Do(request)
			if err != nil {
				t.Fatal("old restored material transport")
			}
			raw, err := io.ReadAll(doc.Body)
			doc.Body.Close()
			if err != nil || doc.StatusCode != 200 || string(raw) != "AT retained material" {
				t.Fatal("old restored original bytes changed")
			}
		}
		if res.StatusCode != 200 {
			t.Fatal("old artifact rejected restored identity")
		}
	}
	auth, e := identity.New(&mysqlstore.Store{DB: app}, nil, "https://campus.test")
	if e != nil {
		t.Fatal("restored identity")
	}
	for _, user := range []string{"teacher-a", "teacher-b", "student-a", "student-a2", "student-b"} {
		issued, err := auth.Login(ctx, user, "test-only-"+user, strings.Repeat("e", 32))
		if err != nil {
			t.Fatal("restored password/session")
		}
		if _, err = auth.Me(ctx, issued.Body.AccessToken); err != nil {
			t.Fatal("restored authorized identity")
		}
	}
	if ex.Check(ctx, 5) != nil || count(t, original, "materials") != 1 || count(t, restored, "materials") != 1 {
		t.Fatal("AT drill damaged upgraded5 or restored4 data")
	}
	t.Log("AT-SC-20 real v4 dump/isolated restore, five identities/original material and actual4/5 artifact matrix passed; upgraded5 preserved")
}
