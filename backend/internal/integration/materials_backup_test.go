//go:build integration && mrbackup

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
// Old binaries come from the exact accepted pre-04 Git commit, not a mock.
func TestMRBackupRestoreAndOldArtifact(t *testing.T) {
	stage := os.Getenv("MR_BACKUP_STAGE")
	ctx := context.Background()
	_, original, name := database(t, 15)
	ex := migrations.Executor{DB: original, Database: name}
	if stage == "prepare" {
		if ex.Up(ctx, 3) != nil || (&mysqlstore.Store{DB: original}).Initialize(ctx, seed(t), nil) != nil {
			t.Fatal("prepare real v3 backup source")
		}
		return
	}
	if stage != "verify" {
		t.Fatal("unknown backup stage")
	}
	if ex.Up(ctx, 4) != nil {
		t.Fatal("upgrade source to4")
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
	runOld("pre04-server", name, false)
	runOld("pre04-admin", name, false, "check")
	app, restored, restoredName := database(t, 16)
	if (migrations.Executor{DB: restored, Database: restoredName}).Check(ctx, 3) != nil || count(t, restored, "users") != 5 || count(t, restored, "classes") != 2 {
		t.Fatal("isolated dump restore lost identity/history")
	}
	runOld("pre04-admin", restoredName, true, "check")
	// Prove the same server/config can actually start against the restored v3
	// database. Otherwise a missing configuration could falsely pass rejection.
	oldServer := exec.Command("/fixtures/pre04-server")
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
		t.Fatal("actual old server failed restored v3 readiness")
	}
	for _, user := range []string{"teacher-a", "teacher-b", "student-a", "student-a2", "student-b"} {
		data, _ := json.Marshal(map[string]string{"username": user, "password": "test-only-" + user})
		res, err := client.Post("http://127.0.0.1:18080/api/v1/auth/login", "application/json", bytes.NewReader(data))
		if err != nil {
			t.Fatal("old artifact restored login")
		}
		io.Copy(io.Discard, res.Body)
		res.Body.Close()
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
	if ex.Check(ctx, 4) != nil {
		t.Fatal("rollback drill damaged preserved v4 database")
	}
	t.Log("MR-SC-08 real v3 dump/isolated restore, five identities and actual pre-04 artifact rejection passed; source v4 preserved")
}
