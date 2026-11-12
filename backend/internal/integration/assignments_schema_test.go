//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
)

// AT-SC-20/21: an identically named table in another database is not the
// reviewed foreign-key target. Neither check nor explicit repair may accept it.
func TestATMigrationRejectsForeignDatabase(t *testing.T) {
	ctx := context.Background()
	_, db, name := database(t, 31)
	_, shadow, shadowName := database(t, 19)
	ex := migrations.Executor{DB: db, Database: name}
	if ex.Up(ctx, 5) != nil {
		t.Fatal("local schema setup")
	}
	atExec(t, shadow, "CREATE TABLE tasks(id BIGINT UNSIGNED NOT NULL PRIMARY KEY) ENGINE=InnoDB")
	restore := func() {
		atExec(t, db, "ALTER TABLE task_outbox DROP FOREIGN KEY fk_outbox_task")
		atExec(t, db, "ALTER TABLE task_outbox ADD CONSTRAINT fk_outbox_task FOREIGN KEY(task_id) REFERENCES tasks(id)")
	}
	atExec(t, db, "ALTER TABLE task_outbox DROP FOREIGN KEY fk_outbox_task")
	atExec(t, db, "ALTER TABLE task_outbox ADD CONSTRAINT fk_outbox_task FOREIGN KEY(task_id) REFERENCES "+shadowName+".tasks(id)")
	t.Cleanup(func() {
		restore()
		atExec(t, shadow, "DROP TABLE tasks")
	})
	if ex.Check(ctx, 5) == nil {
		t.Error("cross-database foreign key passed exact schema check")
	}
	if ex.Repair(ctx, 5) == nil {
		t.Error("cross-database foreign key passed explicit repair")
	}
	// Dirty-state repair must also refuse to clear the migration marker.
	atExec(t, db, "UPDATE schema_migrations SET dirty=1 WHERE version=5")
	if ex.Repair(ctx, 5) == nil {
		t.Error("cross-database foreign key cleared dirty migration")
	}
	var dirty bool
	if db.QueryRow("SELECT dirty FROM schema_migrations WHERE version=5").Scan(&dirty) != nil || !dirty {
		t.Error("invalid repair did not retain dirty marker")
	}
	restore()
	if ex.Repair(ctx, 5) != nil || ex.Check(ctx, 5) != nil {
		t.Fatal("restored same-database schema rejected")
	}
	if !t.Failed() {
		t.Log("AT-SC-20/21 foreign-database Check/Repair rejected; dirty retained; restored local FK accepted")
	}
}
