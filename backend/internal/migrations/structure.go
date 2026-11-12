package migrations

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"strings"
)

// Expected column order/types/nullability and every index/FK are checked before
// repairing dirty metadata. CREATE IF NOT EXISTS alone is not a schema check.
var columns = map[string]string{
	"users":                  "id:bigint unsigned:NO,username:varchar(64):NO,password_hash:varchar(255):NO,role:enum('teacher','student'):NO,enabled:tinyint(1):NO,security_version:bigint:NO",
	"classes":                "id:bigint unsigned:NO,stable_key:varchar(64):NO,name:varchar(128):NO,active:tinyint(1):NO",
	"class_memberships":      "user_id:bigint unsigned:NO,class_id:bigint unsigned:NO,active:tinyint(1):NO",
	"sessions":               "id:char(32):NO,user_id:bigint unsigned:NO,class_id:bigint unsigned:NO,version:bigint:NO,security_version:bigint:NO,refresh_hash:binary(32):NO,refresh_expires:datetime(3):NO,revoked:tinyint(1):NO",
	"access_credentials":     "token_hash:binary(32):NO,session_id:char(32):NO,session_version:bigint:NO,expires_at:datetime(3):NO",
	"auth_audit":             "id:bigint unsigned:NO,action:varchar(32):NO,result:varchar(16):NO,user_id:bigint unsigned:YES,session_id:char(32):YES,request_id:char(32):NO,occurred_at:datetime(3):NO",
	"materials":              "id:bigint unsigned:NO,class_id:bigint unsigned:NO,created_by:bigint unsigned:NO,title:varchar(200):NO,version:int:NO,index_status:enum('pending','indexing','ready','failed','deleted'):NO,raw_bytes:mediumblob:NO,size_bytes:int:NO,body:mediumtext:NO,created_at:datetime(3):NO",
	"material_idempotency":   "user_id:bigint unsigned:NO,class_id:bigint unsigned:NO,idempotency_key:varchar(64):NO,payload_digest:char(64):NO,material_id:bigint unsigned:NO,material_version:int:NO",
	"material_chunks":        "id:bigint unsigned:NO,class_id:bigint unsigned:NO,material_id:bigint unsigned:NO,material_version:int:NO,ordinal:int:NO,char_start:int:NO,char_end:int:NO,quote:text:NO",
	"assignments":            "id:bigint unsigned:NO,class_id:bigint unsigned:NO,teacher_id:bigint unsigned:NO,title:varchar(200):NO,description:mediumtext:NO,deadline:datetime(3):NO,version:bigint unsigned:NO,created_at:datetime(3):NO",
	"submissions":            "id:bigint unsigned:NO,assignment_id:bigint unsigned:NO,class_id:bigint unsigned:NO,assignment_version:bigint unsigned:NO,student_id:bigint unsigned:NO,answer:mediumtext:NO,created_at:datetime(3):NO",
	"tasks":                  "id:bigint unsigned:NO,submission_id:bigint unsigned:NO,status:enum('pending','running','succeeded','failed','cancelled'):NO,attempt:int:NO,execution_epoch:bigint unsigned:NO,version:bigint unsigned:NO,cancel_requested:tinyint(1):NO,created_at:datetime(3):NO,updated_at:datetime(3):NO,error_code:enum('EXECUTION_FAILED','RETRY_EXHAUSTED'):YES,worker_owner:char(32):YES,lease_until:datetime(3):YES",
	"task_outbox":            "task_id:bigint unsigned:NO,available_at:datetime(3):NO,delivery_state:enum('pending','leased','closed'):NO",
	"submission_idempotency": "user_id:bigint unsigned:NO,class_id:bigint unsigned:NO,route:varchar(128):NO,assignment_id:bigint unsigned:NO,idempotency_key:varbinary(64):NO,payload_digest:binary(32):NO,submission_id:bigint unsigned:NO,task_id:bigint unsigned:NO,response_status:enum('pending'):NO",
}
var indexes = map[string][]string{
	"users":                  {"PRIMARY:0:1:id", "uq_users_username:0:1:username"},
	"classes":                {"PRIMARY:0:1:id", "uq_classes_key:0:1:stable_key"},
	"class_memberships":      {"PRIMARY:0:1:user_id", "PRIMARY:0:2:class_id", "ix_membership_class:1:1:class_id"},
	"sessions":               {"PRIMARY:0:1:id", "uq_session_refresh:0:1:refresh_hash", "ix_session_user:1:1:user_id", "ix_session_class:1:1:class_id"},
	"access_credentials":     {"PRIMARY:0:1:token_hash", "ix_access_session:1:1:session_id"},
	"auth_audit":             {"PRIMARY:0:1:id", "ix_audit_request:1:1:request_id", "ix_audit_time:1:1:occurred_at"},
	"materials":              {"PRIMARY:0:1:id", "uq_material_version:0:1:id", "uq_material_version:0:2:class_id", "uq_material_version:0:3:version", "ix_material_class:1:1:class_id", "ix_material_class:1:2:index_status", "ix_material_class:1:3:id", "ix_material_creator:1:1:created_by"},
	"material_idempotency":   {"PRIMARY:0:1:user_id", "PRIMARY:0:2:class_id", "PRIMARY:0:3:idempotency_key", "ix_replay_material:1:1:material_id", "ix_replay_material:1:2:class_id", "ix_replay_material:1:3:material_version"},
	"material_chunks":        {"PRIMARY:0:1:id", "uq_chunk_ordinal:0:1:material_id", "uq_chunk_ordinal:0:2:class_id", "uq_chunk_ordinal:0:3:material_version", "uq_chunk_ordinal:0:4:ordinal", "ix_chunk_class:1:1:class_id", "ix_chunk_class:1:2:material_id", "ix_chunk_class:1:3:material_version", "ix_chunk_class:1:4:ordinal"},
	"assignments":            {"PRIMARY:0:1:id", "uq_assignment_class:0:1:id", "uq_assignment_class:0:2:class_id", "uq_assignment_version:0:1:id", "uq_assignment_version:0:2:class_id", "uq_assignment_version:0:3:version", "ix_assignment_class:1:1:class_id", "ix_assignment_class:1:2:created_at", "ix_assignment_class:1:3:id", "ix_assignment_teacher:1:1:teacher_id"},
	"submissions":            {"PRIMARY:0:1:id", "uq_submission_scope:0:1:id", "uq_submission_scope:0:2:assignment_id", "uq_submission_scope:0:3:class_id", "uq_submission_scope:0:4:student_id", "ix_submission_assignment:1:1:assignment_id", "ix_submission_assignment:1:2:class_id", "ix_submission_assignment:1:3:assignment_version", "ix_submission_class:1:1:assignment_id", "ix_submission_class:1:2:class_id", "ix_submission_class:1:3:created_at", "ix_submission_class:1:4:id", "ix_submission_student:1:1:student_id", "ix_submission_student:1:2:assignment_id", "ix_submission_student:1:3:class_id", "ix_submission_student:1:4:created_at", "ix_submission_student:1:5:id"},
	"tasks":                  {"PRIMARY:0:1:id", "uq_task_submission:0:1:submission_id", "uq_task_receipt:0:1:id", "uq_task_receipt:0:2:submission_id", "ix_task_lease:1:1:status", "ix_task_lease:1:2:lease_until", "ix_task_lease:1:3:id"},
	"task_outbox":            {"PRIMARY:0:1:task_id", "ix_outbox_delivery:1:1:delivery_state", "ix_outbox_delivery:1:2:available_at", "ix_outbox_delivery:1:3:task_id"},
	"submission_idempotency": {"PRIMARY:0:1:user_id", "PRIMARY:0:2:class_id", "PRIMARY:0:3:route", "PRIMARY:0:4:assignment_id", "PRIMARY:0:5:idempotency_key", "ix_submission_replay:1:1:submission_id", "ix_submission_replay:1:2:assignment_id", "ix_submission_replay:1:3:class_id", "ix_submission_replay:1:4:user_id", "ix_task_replay:1:1:task_id", "ix_task_replay:1:2:submission_id"},
}
var foreignKeys = map[string][]string{
	"class_memberships": {"class_id:classes:id", "user_id:users:id"}, "sessions": {"class_id:classes:id", "user_id:users:id"}, "access_credentials": {"session_id:sessions:id"},
	"materials":              {"class_id:classes:id", "created_by:users:id"},
	"material_idempotency":   {"user_id:users:id", "material_id:materials:id", "class_id:materials:class_id", "material_version:materials:version"},
	"material_chunks":        {"material_id:materials:id", "class_id:materials:class_id", "material_version:materials:version"},
	"assignments":            {"class_id:classes:id", "teacher_id:users:id"},
	"submissions":            {"assignment_id:assignments:id", "class_id:assignments:class_id", "assignment_version:assignments:version", "student_id:users:id"},
	"tasks":                  {"submission_id:submissions:id"},
	"task_outbox":            {"task_id:tasks:id"},
	"submission_idempotency": {"submission_id:submissions:id", "assignment_id:submissions:assignment_id", "class_id:submissions:class_id", "user_id:submissions:student_id", "task_id:tasks:id", "submission_id:tasks:submission_id"},
}

func (e Executor) strings(ctx context.Context, query, table string) ([]string, error) {
	rows, err := e.DB.QueryContext(ctx, query, e.Database, table)
	if err != nil {
		return nil, ErrState
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if rows.Scan(&s) != nil {
			return nil, ErrState
		}
		out = append(out, s)
	}
	if rows.Err() != nil {
		return nil, ErrState
	}
	return out, nil
}
func equal(a, b []string) bool {
	a = append([]string{}, a...)
	b = append([]string{}, b...)
	sort.Strings(a)
	sort.Strings(b)
	return strings.Join(a, "|") == strings.Join(b, "|")
}
func (e Executor) Structure(ctx context.Context, version int) error {
	return e.structure(ctx, version, false)
}

// During explicit repair, validate every already-created object before issuing
// another DDL statement. Missing tables alone are allowed in this preflight.
func (e Executor) structure(ctx context.Context, version int, partial bool) error {
	tables := []string{"users", "classes", "class_memberships"}
	if version >= 2 {
		tables = append(tables, "sessions", "access_credentials")
	}
	if version >= 3 {
		tables = append(tables, "auth_audit")
	}
	if version >= 4 {
		tables = append(tables, "materials", "material_idempotency", "material_chunks")
	}
	if version >= 5 {
		tables = append(tables, "assignments", "submissions", "tasks", "task_outbox", "submission_idempotency")
	}
	for _, table := range tables {
		var engine string
		err := e.DB.QueryRowContext(ctx, "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?", e.Database, table).Scan(&engine)
		if partial && errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil || engine != "InnoDB" {
			return ErrState
		}
		cols, err := e.strings(ctx, "SELECT CONCAT(COLUMN_NAME,':',COLUMN_TYPE,':',IS_NULLABLE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", table)
		if err != nil || strings.Join(cols, ",") != columns[table] {
			return ErrState
		}
		// Exact username/key matching and opaque tokens require binary collations;
		// a preexisting case-insensitive table is not safe to force clean.
		var invalid int
		query := `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND ((COLUMN_NAME IN ('username','stable_key') AND COLLATION_NAME<>'utf8mb4_0900_bin') OR (COLUMN_NAME IN ('password_hash','session_id','request_id') AND COLLATION_NAME<>'ascii_bin') OR (COLUMN_NAME='id' AND DATA_TYPE='char' AND COLLATION_NAME<>'ascii_bin') OR (COLUMN_NAME='id' AND DATA_TYPE='bigint' AND EXTRA<>'auto_increment') OR ((COLUMN_NAME IN ('enabled','active') OR (TABLE_NAME='users' AND COLUMN_NAME='security_version')) AND COALESCE(COLUMN_DEFAULT,'')<>'1') OR (COLUMN_NAME='revoked' AND COALESCE(COLUMN_DEFAULT,'')<>'0'))`
		if e.DB.QueryRowContext(ctx, query, e.Database, table).Scan(&invalid) != nil || invalid != 0 {
			return ErrState
		}
		if version >= 4 && (table == "materials" || table == "material_idempotency" || table == "material_chunks") {
			query = `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND ((COLUMN_NAME IN ('title','body','quote') AND COLLATION_NAME<>'utf8mb4_0900_bin') OR (COLUMN_NAME IN ('idempotency_key','payload_digest') AND COLLATION_NAME<>'ascii_bin') OR (COLUMN_NAME='index_status' AND COALESCE(COLUMN_DEFAULT,'')<>'pending') OR (COLUMN_NAME<>'index_status' AND COLUMN_DEFAULT IS NOT NULL) OR (COLUMN_NAME<>'id' AND EXTRA<>'') OR GENERATION_EXPRESSION<>'')`
			if e.DB.QueryRowContext(ctx, query, e.Database, table).Scan(&invalid) != nil || invalid != 0 {
				return ErrState
			}
			// A cascaded delete or split composite FK is not the approved schema.
			query = `SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME=? AND (DELETE_RULE<>'NO ACTION' AND DELETE_RULE<>'RESTRICT' OR UPDATE_RULE<>'NO ACTION' AND UPDATE_RULE<>'RESTRICT')`
			if e.DB.QueryRowContext(ctx, query, e.Database, table).Scan(&invalid) != nil || invalid != 0 {
				return ErrState
			}
			if table != "materials" {
				grouped, er := e.strings(ctx, `SELECT CONCAT(CONSTRAINT_NAME,':',ORDINAL_POSITION,':',COLUMN_NAME,':',REFERENCED_COLUMN_NAME) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME='materials'`, table)
				name := "fk_chunk_material"
				if table == "material_idempotency" {
					name = "fk_replay_material"
				}
				if er != nil || !equal(grouped, []string{name + ":1:material_id:id", name + ":2:class_id:class_id", name + ":3:material_version:version"}) {
					return ErrState
				}
			}
		}

		if version >= 5 && assignmentTables[table] != nil {
			if err := e.assignmentStructure(ctx, table); err != nil {
				return err
			}
		}
		keys, err := e.strings(ctx, "SELECT CONCAT(INDEX_NAME,':',NON_UNIQUE,':',SEQ_IN_INDEX,':',COLUMN_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?", table)
		if err != nil || !equal(keys, indexes[table]) {
			return ErrState
		}
		fks, err := e.strings(ctx, "SELECT CONCAT(COLUMN_NAME,':',REFERENCED_TABLE_NAME,':',REFERENCED_COLUMN_NAME) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL", table)
		if err != nil || !equal(fks, foreignKeys[table]) {
			return ErrState
		}
	}
	return nil
}
