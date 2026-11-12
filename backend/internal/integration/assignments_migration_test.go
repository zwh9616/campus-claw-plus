//go:build integration

package integration

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"github.com/go-sql-driver/mysql"
	"os"
	"strings"
	"testing"

	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

// AT-SC-20/21: these are schema fixtures, never a production task executor or
// evidence that the nine still-frozen business operations have been implemented.
var atTables = []string{"assignments", "submissions", "tasks", "task_outbox", "submission_idempotency"}

func atExec(t *testing.T, db *sql.DB, query string, args ...any) sql.Result {
	t.Helper()
	r, e := db.Exec(query, args...)
	if e != nil {
		var driverError *mysql.MySQLError
		if errors.As(e, &driverError) {
			t.Fatalf("AT schema fixture statement failed: MySQL errno %d", driverError.Number)
		}
		t.Fatal("AT schema fixture statement failed without a server error code")
	}
	return r
}
func atID(t *testing.T, r sql.Result) int64 {
	t.Helper()
	n, e := r.LastInsertId()
	if e != nil {
		t.Fatal("fixture ID")
	}
	return n
}
func atSeedV4(t *testing.T, app, db *sql.DB, name string) (identity.Principal, materials.Material) {
	t.Helper()
	ctx := context.Background()
	ex := migrations.Executor{DB: db, Database: name}
	if ex.Up(ctx, 4) != nil || (&mysqlstore.Store{DB: db}).Initialize(ctx, seed(t), nil) != nil {
		t.Fatal("AT baseline4")
	}
	repo := &mysqlstore.Store{DB: app}
	auth, e := identity.New(repo, nil, "https://campus.test")
	if e != nil {
		t.Fatal("auth")
	}
	issued, e := auth.Login(ctx, "teacher-a", "test-only-teacher-a", strings.Repeat("a", 32))
	if e != nil {
		t.Fatal("baseline login")
	}
	u, e := materials.PrepareUpload("AT backup source", "f.txt", []byte("AT retained material"))
	if e != nil {
		t.Fatal("material input")
	}
	m, _, e := (&materials.Service{Repo: repo}).Create(ctx, issued.Body.Principal, "at_migration_data_01", u)
	if e != nil || m.IndexStatus != "ready" {
		t.Fatal("baseline ready material")
	}
	return issued.Body.Principal, m
}
func atCheckOldData(t *testing.T, app, db *sql.DB, p identity.Principal, m materials.Material) {
	t.Helper()
	if count(t, db, "users") != 5 || count(t, db, "materials") != 1 {
		t.Fatal("AT upgrade changed old data")
	}
	repo := &mysqlstore.Store{DB: app}
	doc, e := repo.GetMaterial(context.Background(), p, m.ID)
	if e != nil || string(doc.Raw) != "AT retained material" || doc.Material.IndexStatus != "ready" {
		t.Fatal("AT old material changed")
	}
	found, e := repo.SearchMaterials(context.Background(), p, "retained", 4)
	if e != nil || len(found.Items) != 1 {
		t.Fatal("AT old search failed")
	}
}
func TestATMigrationEmptyAndUpgrade(t *testing.T) {
	ctx := context.Background()
	for i := 20; i <= 21; i++ {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			app, db, name := database(t, i)
			ex := migrations.Executor{DB: db, Database: name}
			var p identity.Principal
			var m materials.Material
			if i == 21 {
				p, m = atSeedV4(t, app, db, name)
				if ex.Check(ctx, 5) == nil {
					t.Fatal("new target accepted old4")
				}
			}
			if ex.Up(ctx, 5) != nil || ex.Up(ctx, 5) != nil || ex.Check(ctx, 5) != nil {
				t.Fatal("AT empty/upgrade/repeat5")
			}
			if ex.Check(ctx, 4) == nil || ex.Up(ctx, 4) == nil {
				t.Fatal("old exact target accepted5")
			}
			for _, table := range atTables {
				if count(t, db, table) != 0 {
					t.Fatal("migration manufactured business records")
				}
			}
			if i == 21 {
				atCheckOldData(t, app, db, p, m)
			}
		})
	}
}
func TestATMigrationEachDDLAndForwardRepair(t *testing.T) {
	ctx := context.Background()
	for step := 1; step <= 5; step++ {
		t.Run(fmt.Sprint(step), func(t *testing.T) {
			app, db, name := database(t, 21+step)
			p, m := atSeedV4(t, app, db, name)
			ex := migrations.Executor{DB: db, Database: name, AfterDDL: func(v, n int) error {
				if v == 5 && n == step {
					return errors.New("AT controlled interruption")
				}
				return nil
			}}
			if ex.Up(ctx, 5) == nil || ex.Check(ctx, 5) == nil {
				t.Fatal("AT interrupted DDL was accepted")
			}
			var v int
			var dirty bool
			if db.QueryRow("SELECT version,dirty FROM schema_migrations").Scan(&v, &dirty) != nil || v != 5 || !dirty {
				t.Fatal("AT dirty state not preserved")
			}
			ex.AfterDDL = nil
			// Preflight must reject drift before adding any remaining table or clearing dirty.
			atExec(t, db, "ALTER TABLE assignments MODIFY title VARCHAR(201) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL")
			if ex.Repair(ctx, 5) == nil {
				t.Fatal("AT partial drift accepted")
			}
			var exists int
			db.QueryRow("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN ('assignments','submissions','tasks','task_outbox','submission_idempotency')", name).Scan(&exists)
			if exists != step {
				t.Fatal("AT repair mutated schema before validating existing objects")
			}
			atExec(t, db, "ALTER TABLE assignments MODIFY title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL")
			if ex.Repair(ctx, 5) != nil || ex.Repair(ctx, 5) != nil || ex.Up(ctx, 5) != nil || ex.Check(ctx, 5) != nil {
				t.Fatal("AT explicit repair/repeat failed")
			}
			atCheckOldData(t, app, db, p, m)
		})
	}
}
func TestATMigrationDriftHistoryAndBinaryScopes(t *testing.T) {
	app, db, name := database(t, 30)
	ctx := context.Background()
	p, _ := atSeedV4(t, app, db, name)
	ex := migrations.Executor{DB: db, Database: name}
	if ex.Up(ctx, 5) != nil {
		t.Fatal("AT drift setup")
	}
	// Same columns targeting the same tables are insufficient: the composite FK
	// grouping, exact names and ordering must match as one ownership constraint.
	cases := [][2]string{
		{"ALTER TABLE submission_idempotency DROP PRIMARY KEY, ADD PRIMARY KEY(user_id,class_id,route,assignment_id,idempotency_key(16))", "ALTER TABLE submission_idempotency DROP PRIMARY KEY, ADD PRIMARY KEY(user_id,class_id,route,assignment_id,idempotency_key)"},
		{"ALTER TABLE assignments MODIFY title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL", "ALTER TABLE assignments MODIFY title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL"},
		{"ALTER TABLE assignments ALTER version SET DEFAULT 1", "ALTER TABLE assignments ALTER version DROP DEFAULT"},
		{"ALTER TABLE tasks MODIFY worker_owner CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci NULL", "ALTER TABLE tasks MODIFY worker_owner CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL"},
		{"ALTER TABLE task_outbox DROP INDEX ix_outbox_delivery", "ALTER TABLE task_outbox ADD KEY ix_outbox_delivery(delivery_state,available_at,task_id)"},
		{"ALTER TABLE submissions DROP FOREIGN KEY fk_submission_assignment, ADD CONSTRAINT wrong_group FOREIGN KEY(assignment_id,class_id,assignment_version) REFERENCES assignments(id,class_id,version)", "ALTER TABLE submissions DROP FOREIGN KEY wrong_group, ADD CONSTRAINT fk_submission_assignment FOREIGN KEY(assignment_id,class_id,assignment_version) REFERENCES assignments(id,class_id,version)"},
		{"ALTER TABLE task_outbox DROP FOREIGN KEY fk_outbox_task, ADD CONSTRAINT wrong_cascade FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE", "ALTER TABLE task_outbox DROP FOREIGN KEY wrong_cascade, ADD CONSTRAINT fk_outbox_task FOREIGN KEY(task_id) REFERENCES tasks(id)"},
	}
	for i, c := range cases {
		t.Logf("AT controlled drift index %d", i)
		atExec(t, db, c[0])
		if ex.Check(ctx, 5) == nil || ex.Repair(ctx, 5) == nil {
			t.Fatalf("AT drift %d accepted", i)
		}
		atExec(t, db, c[1])
		if ex.Check(ctx, 5) != nil {
			t.Fatal("restored drift still rejected")
		}
	}
	var digest string
	db.QueryRow("SELECT up_sha256 FROM identity_migration_checksums WHERE version=5").Scan(&digest)
	atExec(t, db, "UPDATE identity_migration_checksums SET up_sha256=? WHERE version=5", strings.Repeat("0", 64))
	if ex.Check(ctx, 5) == nil || ex.Up(ctx, 5) == nil || ex.Repair(ctx, 5) == nil {
		t.Fatal("AT wrong immutable history accepted")
	}
	atExec(t, db, "UPDATE identity_migration_checksums SET up_sha256=? WHERE version=5", digest)
	atExec(t, db, "DELETE FROM identity_migration_checksums WHERE version=5")
	if ex.Check(ctx, 5) == nil || ex.Repair(ctx, 5) != nil {
		t.Fatal("AT missing history must block then explicit repair")
	}
	// Synthetic rows exercise SQL ownership/receipt constraints and opaque ASCII
	// keys including trailing spaces; they do not exercise the future submit API.
	var student int64
	db.QueryRow("SELECT id FROM users WHERE username='student-a'").Scan(&student)
	a := atID(t, atExec(t, db, "INSERT INTO assignments(class_id,teacher_id,title,description,deadline,version,created_at) VALUES(?,?,'fixture','fixture',UTC_TIMESTAMP(3)+INTERVAL 1 DAY,1,UTC_TIMESTAMP(3))", p.ClassID, p.UserID))
	sub := atID(t, atExec(t, db, "INSERT INTO submissions(assignment_id,class_id,assignment_version,student_id,answer,created_at) VALUES(?,?,1,?,'fixture',UTC_TIMESTAMP(3))", a, p.ClassID, student))
	task := atID(t, atExec(t, db, "INSERT INTO tasks(submission_id,status,attempt,execution_epoch,version,cancel_requested,created_at,updated_at) VALUES(?,'pending',0,0,1,0,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", sub))
	if _, e := db.Exec("INSERT INTO tasks(submission_id,status,attempt,execution_epoch,version,cancel_requested,created_at,updated_at) VALUES(?,'pending',0,0,1,0,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", sub); e == nil {
		t.Fatal("duplicate task per submission accepted")
	}
	atExec(t, db, "INSERT INTO task_outbox(task_id,available_at,delivery_state) VALUES(?,UTC_TIMESTAMP(3),'pending')", task)
	route := "/api/v1/assignments/{id}/submissions"
	for _, key := range []string{"aaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaa ", "Aaaaaaaaaaaaaaaa"} {
		atExec(t, db, "INSERT INTO submission_idempotency(user_id,class_id,route,assignment_id,idempotency_key,payload_digest,submission_id,task_id,response_status) VALUES(?,?,?,?,?,UNHEX(SHA2('fixture',256)),?,?,'pending')", student, p.ClassID, route, a, []byte(key), sub, task)
	}
	if count(t, db, "submission_idempotency") != 3 {
		t.Fatal("AT opaque keys collided")
	}
	if _, e := db.Exec("INSERT INTO submission_idempotency(user_id,class_id,route,assignment_id,idempotency_key,payload_digest,submission_id,task_id,response_status) VALUES(?,?,?,?,?,UNHEX(SHA2('fixture',256)),?,?,'pending')", student, p.ClassID, route, a, []byte("aaaaaaaaaaaaaaaa"), sub, task); e == nil {
		t.Fatal("duplicate opaque scope accepted")
	}
	if _, e := db.Exec("INSERT INTO submissions(assignment_id,class_id,assignment_version,student_id,answer,created_at) VALUES(?,?,2,?,'fixture',UTC_TIMESTAMP(3))", a, p.ClassID, student); e == nil {
		t.Fatal("unbound assignment version accepted")
	}
	if _, e := db.Exec("INSERT INTO submission_idempotency(user_id,class_id,route,assignment_id,idempotency_key,payload_digest,submission_id,task_id,response_status) VALUES(?,?,?,?,?,UNHEX(SHA2('fixture',256)),?,?,'pending')", p.UserID, p.ClassID, route, a, []byte("bbbbbbbbbbbbbbbb"), sub, task); e == nil {
		t.Fatal("replay owner does not match submission")
	}
	if _, e := db.Exec("CREATE TABLE forbidden_ddl(id INT)"); e != nil {
		t.Fatal("offline DDL should remain available")
	}
	if _, e := app.Exec("CREATE TABLE forbidden_app_ddl(id INT)"); e == nil {
		t.Fatal("runtime acquired DDL privileges")
	}
	if ex.Check(ctx, 5) != nil {
		t.Fatal("valid schema/data rejected")
	}
}
func TestATEmptyDownOnly(t *testing.T) {
	_, db, name := database(t, 27)
	ctx := context.Background()
	ex := migrations.Executor{DB: db, Database: name}
	if ex.Up(ctx, 5) != nil {
		t.Fatal("AT empty down setup")
	}
	for _, table := range append([]string{"users", "classes", "materials"}, atTables...) {
		if count(t, db, table) != 0 {
			t.Fatal("AT down requires dedicated empty schema")
		}
	}
	data, e := os.ReadFile("../migrations/sql/000005_assignment_tasks.down.sql")
	if e != nil {
		t.Fatal("AT down file")
	}
	if _, e = db.Exec(string(data)); e != nil {
		t.Fatal("AT child-first empty down")
	}
	if ex.Check(ctx, 5) == nil {
		t.Fatal("AT missing fifth structure accepted")
	}
	if ex.Structure(ctx, 4) != nil || ex.Structure(ctx, 3) != nil {
		t.Fatal("AT down damaged old schema")
	}
}
