//go:build integration

package integration

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
)

var diTables = []string{"documents", "document_locations", "document_chunks", "document_parse_jobs", "document_idempotency"}

func TestDIMigration6FreshUpgradeAndHistory(t *testing.T) {
	ctx := context.Background()
	for _, from := range []int{0, 5} {
		t.Run(fmt.Sprint(from), func(t *testing.T) {
			app, db, name := database(t, 48+from)
			e := migrations.Executor{DB: db, Database: name}
			if from == 5 {
				p, m := atSeedV4(t, app, db, name)
				if e.Up(ctx, 5) != nil {
					t.Fatal("prepare5")
				}
				if e.Up(ctx, 6) != nil {
					t.Fatal("upgrade6")
				}
				atCheckOldData(t, app, db, p, m)
			} else if e.Up(ctx, 6) != nil {
				t.Fatal("fresh6")
			}
			if migrations.Target != 6 || e.Check(ctx, 6) != nil || e.Up(ctx, 6) != nil || e.Check(ctx, 5) == nil {
				t.Fatal("exact6 or repeat")
			}
			for _, table := range diTables {
				if count(t, db, table) != 0 {
					t.Fatal("migration manufactured document", table)
				}
			}
			var checksums int
			if db.QueryRow("SELECT COUNT(*) FROM identity_migration_checksums").Scan(&checksums) != nil || checksums != 6 {
				t.Fatal("immutable history missing")
			}
			var old string
			db.QueryRow("SELECT up_sha256 FROM identity_migration_checksums WHERE version=6").Scan(&old)
			atExec(t, db, "UPDATE identity_migration_checksums SET up_sha256=? WHERE version=6", strings.Repeat("0", 64))
			if e.Check(ctx, 6) == nil || e.Up(ctx, 6) == nil || e.Repair(ctx, 6) == nil {
				t.Fatal("bad checksum accepted")
			}
			atExec(t, db, "UPDATE identity_migration_checksums SET up_sha256=? WHERE version=6", old)
			atExec(t, db, "DELETE FROM identity_migration_checksums WHERE version=6")
			if e.Check(ctx, 6) == nil || e.Repair(ctx, 6) != nil || e.Check(ctx, 6) != nil {
				t.Fatal("explicit complete-history repair")
			}
		})
	}
}

func TestDIFiveDDLInterruptionAndForwardRepair(t *testing.T) {
	ctx := context.Background()
	for step := 1; step <= 5; step++ {
		t.Run(fmt.Sprint(step), func(t *testing.T) {
			_, db, name := database(t, 54+step)
			e := migrations.Executor{DB: db, Database: name}
			if e.Up(ctx, 5) != nil {
				t.Fatal("baseline5")
			}
			e.AfterDDL = func(v, n int) error {
				if v == 6 && n == step {
					return errors.New("controlled DDL interruption")
				}
				return nil
			}
			if e.Up(ctx, 6) == nil || e.Check(ctx, 6) == nil {
				t.Fatal("interrupted migration passed")
			}
			var version int
			var dirty bool
			if db.QueryRow("SELECT version,dirty FROM schema_migrations").Scan(&version, &dirty) != nil || version != 6 || !dirty {
				t.Fatal("dirty6 not retained")
			}
			e.AfterDDL = nil
			// The first table exists after every interruption; incompatible schema
			// must block repair before any missing table can be created.
			atExec(t, db, "ALTER TABLE documents MODIFY title VARCHAR(199) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL")
			if e.Repair(ctx, 6) == nil {
				t.Fatal("repair hid existing schema drift")
			}
			if db.QueryRow("SELECT dirty FROM schema_migrations").Scan(&dirty) != nil || !dirty {
				t.Fatal("drift cleared dirty")
			}
			atExec(t, db, "ALTER TABLE documents MODIFY title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL")
			if e.Repair(ctx, 6) != nil || e.Repair(ctx, 6) != nil || e.Up(ctx, 6) != nil || e.Check(ctx, 6) != nil {
				t.Fatal("exact forward repair failed")
			}
		})
	}
}

func TestDIExactStructureDrift(t *testing.T) {
	_, db, name := database(t, 60)
	ctx := context.Background()
	e := migrations.Executor{DB: db, Database: name}
	if e.Up(ctx, 6) != nil {
		t.Fatal("fresh6")
	}
	for _, test := range []struct{ name, change, restore string }{
		{"column", "ALTER TABLE documents MODIFY title VARCHAR(199) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL", "ALTER TABLE documents MODIFY title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL"},
		{"default", "ALTER TABLE documents ALTER attempts SET DEFAULT 1", "ALTER TABLE documents ALTER attempts SET DEFAULT 0"},
		{"collation", "ALTER TABLE documents MODIFY title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL", "ALTER TABLE documents MODIFY title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL"},
		{"index-order", "ALTER TABLE documents DROP INDEX ix_document_class, ADD INDEX ix_document_class(class_id,id,status)", "ALTER TABLE documents DROP INDEX ix_document_class, ADD INDEX ix_document_class(class_id,status,id)"},
		{"index-prefix", "ALTER TABLE documents ADD INDEX ix_poison(title(4))", "ALTER TABLE documents DROP INDEX ix_poison"},
		{"index-descending", "ALTER TABLE documents DROP INDEX ix_document_class, ADD INDEX ix_document_class(class_id,status,id DESC)", "ALTER TABLE documents DROP INDEX ix_document_class, ADD INDEX ix_document_class(class_id,status,id)"},
		{"index-invisible", "ALTER TABLE document_chunks ALTER INDEX ix_document_chunk_class INVISIBLE", "ALTER TABLE document_chunks ALTER INDEX ix_document_chunk_class VISIBLE"},
		{"table-collation", "ALTER TABLE document_parse_jobs DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci", "ALTER TABLE document_parse_jobs DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin"},
		{"check-expression", "ALTER TABLE documents DROP CHECK ck_document_attempts, ADD CONSTRAINT ck_document_attempts CHECK(attempts<=4)", "ALTER TABLE documents DROP CHECK ck_document_attempts, ADD CONSTRAINT ck_document_attempts CHECK(attempts<=3)"},
		{"check-enforcement", "ALTER TABLE documents ALTER CHECK ck_document_attempts NOT ENFORCED", "ALTER TABLE documents ALTER CHECK ck_document_attempts ENFORCED"},
		{"engine", "ALTER TABLE document_idempotency ROW_FORMAT=COMPACT", "ALTER TABLE document_idempotency ROW_FORMAT=DYNAMIC"},
		{"binary-key", "ALTER TABLE document_idempotency MODIFY idempotency_key VARBINARY(63) NOT NULL", "ALTER TABLE document_idempotency MODIFY idempotency_key VARBINARY(64) NOT NULL"},
		{"lease-predicate", "ALTER TABLE document_parse_jobs DROP CHECK ck_document_job_lease, ADD CONSTRAINT ck_document_job_lease CHECK(execution_epoch>=0)", ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			atExec(t, db, test.change)
			if e.Check(ctx, 6) == nil || e.Repair(ctx, 6) == nil {
				t.Fatal("drift accepted")
			}
			if test.restore != "" {
				atExec(t, db, test.restore)
			} else {
				// Recreate only the empty independent job table using reviewed DDL.
				atExec(t, db, "DROP TABLE document_parse_jobs")
				atExec(t, db, "UPDATE schema_migrations SET dirty=1")
				if e.Repair(ctx, 6) != nil {
					t.Fatal("repair missing empty job table")
				}
			}
			if e.Check(ctx, 6) != nil {
				t.Fatal("exact schema did not recover")
			}
		})
	}
	// FK schema identity matters even when foreign database columns are equal.
	_, other, otherName := database(t, 61)
	if (migrations.Executor{DB: other, Database: otherName}).Up(ctx, 6) != nil {
		t.Fatal("foreign schema")
	}
	atExec(t, db, "ALTER TABLE document_parse_jobs DROP FOREIGN KEY fk_document_job")
	atExec(t, db, "ALTER TABLE document_parse_jobs ADD CONSTRAINT fk_document_job FOREIGN KEY(document_id,class_id,document_version) REFERENCES "+otherName+".documents(id,class_id,version)")
	if e.Check(ctx, 6) == nil || e.Repair(ctx, 6) == nil {
		t.Fatal("cross-schema FK accepted")
	}
	atExec(t, db, "ALTER TABLE document_parse_jobs DROP FOREIGN KEY fk_document_job")
	atExec(t, db, "ALTER TABLE document_parse_jobs ADD CONSTRAINT fk_document_job FOREIGN KEY(document_id,class_id,document_version) REFERENCES documents(id,class_id,version)")
	if e.Check(ctx, 6) != nil {
		t.Fatal("local FK recovery")
	}
	// Same table and columns, wrong composite-column order must also fail.
	atExec(t, db, "ALTER TABLE documents ADD UNIQUE KEY uq_poison(id,version,class_id)")
	atExec(t, db, "ALTER TABLE document_parse_jobs DROP FOREIGN KEY fk_document_job")
	atExec(t, db, "ALTER TABLE document_parse_jobs ADD CONSTRAINT fk_document_job FOREIGN KEY(document_id,document_version,class_id) REFERENCES documents(id,version,class_id)")
	if e.Check(ctx, 6) == nil || e.Repair(ctx, 6) == nil {
		t.Fatal("wrong FK order accepted")
	}
	atExec(t, db, "ALTER TABLE document_parse_jobs DROP FOREIGN KEY fk_document_job")
	atExec(t, db, "ALTER TABLE document_parse_jobs DROP INDEX fk_document_job")
	atExec(t, db, "ALTER TABLE document_parse_jobs ADD CONSTRAINT fk_document_job FOREIGN KEY(document_id,class_id,document_version) REFERENCES documents(id,class_id,version)")
	atExec(t, db, "ALTER TABLE documents DROP INDEX uq_poison")
	if e.Check(ctx, 6) != nil {
		t.Fatal("FK order recovery")
	}
	// MyISAM has no ownership FKs; after explicitly removing that FK only in
	// this empty fixture, changing the engine must remain a hard rejection.
	atExec(t, db, "ALTER TABLE document_idempotency DROP FOREIGN KEY fk_document_replay")
	atExec(t, db, "ALTER TABLE document_idempotency ENGINE=MyISAM")
	if e.Check(ctx, 6) == nil || e.Repair(ctx, 6) == nil {
		t.Fatal("wrong engine accepted")
	}
	atExec(t, db, "ALTER TABLE document_idempotency ENGINE=InnoDB")
	atExec(t, db, "ALTER TABLE document_idempotency ADD CONSTRAINT fk_document_replay FOREIGN KEY(document_id,class_id,document_version,user_id) REFERENCES documents(id,class_id,version,created_by)")
	if e.Check(ctx, 6) != nil {
		t.Fatal("InnoDB ownership recovery")
	}
}

func TestDIEmptyDisposableDownOnly(t *testing.T) {
	_, db, name := database(t, 62)
	ctx := context.Background()
	e := migrations.Executor{DB: db, Database: name}
	if e.Up(ctx, 6) != nil {
		t.Fatal("fresh6")
	}
	if e.DownEmptyDocumentsForTest(ctx, "holder_database") == nil {
		t.Fatal("unconfirmed database down")
	}
	for _, tc := range []struct{ table, insert string }{
		{"documents", "INSERT INTO documents(id,class_id,created_by,title,format,version,status,original_bytes,original_digest,size_bytes,created_at,updated_at) VALUES(999,999,999,'test','pdf',1,'queued','x',UNHEX(SHA2('x',256)),1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))"},
		{"document_locations", "INSERT INTO document_locations VALUES(999,999,1,1,'pdf_page',0,1)"},
		{"document_chunks", "INSERT INTO document_chunks(document_id,class_id,document_version,unit,ordinal,char_start,char_end,quote) VALUES(999,999,1,1,1,0,1,'x')"},
		{"document_parse_jobs", "INSERT INTO document_parse_jobs VALUES(999,999,1,'pending',UTC_TIMESTAMP(3),NULL,0,NULL)"},
		{"document_idempotency", "INSERT INTO document_idempotency VALUES(999,999,'abcdefghijklmnop',UNHEX(SHA2('x',256)),999,1,'{}')"},
	} {
		// Deliberate orphan corruption isolates each child-table guard while
		// documents remains empty; never used by runtime writes.
		conn, err := db.Conn(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = conn.ExecContext(ctx, "SET FOREIGN_KEY_CHECKS=0"); err != nil {
			t.Fatal(err)
		}
		if _, err = conn.ExecContext(ctx, tc.insert); err != nil {
			t.Fatal("orphan fixture")
		}
		conn.ExecContext(ctx, "SET FOREIGN_KEY_CHECKS=1")
		conn.Close()
		if e.DownEmptyDocumentsForTest(ctx, name) == nil {
			t.Fatal("nonempty table down", tc.table)
		}
		var dirty bool
		if db.QueryRow("SELECT dirty FROM schema_migrations").Scan(&dirty) != nil || dirty {
			t.Fatal("rejected down changed metadata")
		}
		atExec(t, db, "DELETE FROM "+tc.table)
	}
	if e.DownEmptyDocumentsForTest(ctx, name) != nil || e.Check(ctx, 6) == nil || e.Structure(ctx, 5) != nil {
		t.Fatal("empty reverse DDL or old structure")
	}
	var dirty bool
	if db.QueryRow("SELECT dirty FROM schema_migrations").Scan(&dirty) != nil || !dirty {
		t.Fatal("test down masqueraded as production rollback")
	}
}
