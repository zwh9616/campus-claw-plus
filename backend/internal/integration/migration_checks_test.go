//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"os"
	"os/exec"
	"strings"
	"testing"
)

func TestIDFMigrationMetadataAndEmptyDown(t *testing.T) {
	ctx := context.Background()
	_, db, name := database(t, 8)
	ex := migrations.Executor{DB: db, Database: name}
	if e := ex.Up(ctx, 3); e != nil {
		t.Fatal(e)
	}
	var up string
	if db.QueryRow("SELECT up_sha256 FROM identity_migration_checksums WHERE version=3").Scan(&up) != nil {
		t.Fatal("checksum fixture")
	}
	if _, e := db.Exec("UPDATE identity_migration_checksums SET up_sha256=? WHERE version=3", strings.Repeat("0", 64)); e != nil {
		t.Fatal("checksum mutation")
	}
	if ex.Check(ctx, 3) == nil || ex.Up(ctx, 3) == nil || ex.Repair(ctx, 3) == nil {
		t.Fatal("modified history accepted")
	}
	if _, e := db.Exec("UPDATE identity_migration_checksums SET up_sha256=? WHERE version=3", up); e != nil {
		t.Fatal("checksum restore")
	}
	if _, e := db.Exec("DELETE FROM identity_migration_checksums WHERE version=3"); e != nil {
		t.Fatal("metadata window")
	}
	if ex.Check(ctx, 3) == nil {
		t.Fatal("missing checksum accepted")
	}
	if ex.Repair(ctx, 3) != nil {
		t.Fatal("metadata window repair")
	}
	if _, e := db.Exec("ALTER TABLE users ALTER COLUMN enabled SET DEFAULT 0"); e != nil {
		t.Fatal("structure mutation")
	}
	if ex.Check(ctx, 3) == nil || ex.Repair(ctx, 3) == nil {
		t.Fatal("invalid structure accepted")
	}
	if _, e := db.Exec("ALTER TABLE users ALTER COLUMN enabled SET DEFAULT 1"); e != nil {
		t.Fatal("structure restore")
	}
	// Execute down files only on this dedicated, asserted-empty disposable DB.
	for _, table := range []string{"users", "classes", "class_memberships", "sessions", "access_credentials", "auth_audit"} {
		if count(t, db, table) != 0 {
			t.Fatal("down requires empty fixture")
		}
	}
	names := []string{"identity_users_classes", "identity_sessions", "identity_auth_audit"}
	for v := 3; v >= 1; v-- {
		sql, e := os.ReadFile(fmt.Sprintf("../migrations/sql/%06d_%s.down.sql", v, names[v-1]))
		if e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec(string(sql)); e != nil {
			t.Fatal("empty fixture down")
		}
	}
	if _, e := db.Exec("DELETE FROM schema_migrations; DELETE FROM identity_migration_checksums"); e != nil {
		t.Fatal("empty fixture metadata")
	}
	if ex.Up(ctx, 3) != nil {
		t.Fatal("down/up")
	}
	// Exercise the actual offline executable with secrets in environment/stdin,
	// never command arguments. This target is our dedicated disposable database.
	input, _ := json.Marshal(seed(t))
	for _, action := range []string{"migrate", "check", "initialize", "initialize"} {
		cmd := exec.Command("/fixtures/identity-admin", action)
		for _, entry := range os.Environ() {
			if strings.HasPrefix(entry, "MYSQL_DSN=") || strings.HasPrefix(entry, "MYSQL_MIGRATION_DSN=") {
				entry = strings.Replace(entry, "/idf_test_0?", "/idf_test_8?", 1)
			}
			cmd.Env = append(cmd.Env, entry)
		}
		cmd.Stdin = bytes.NewReader(input)
		out, e := cmd.CombinedOutput()
		if e != nil || !bytes.Contains(out, []byte("completed")) {
			t.Fatal("offline command failed", action)
		}
	}
	bad := exec.Command("/fixtures/identity-admin", "check")
	bad.Env = []string{"MYSQL_DSN=", "MYSQL_CA_FILE="}
	if bad.Run() == nil {
		t.Fatal("missing config did not exit nonzero")
	}
}
