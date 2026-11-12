package migrations

import "context"

// AT-SC-20: composite ownership/receipt FKs and exact binary key semantics are
// checked before repair can clear dirty metadata. No cascaded deletes.
var assignmentTables = map[string][]string{
	"assignments":            {"fk_assignment_class:1:class_id:classes:id", "fk_assignment_teacher:1:teacher_id:users:id"},
	"submissions":            {"fk_submission_assignment:1:assignment_id:assignments:id", "fk_submission_assignment:2:class_id:assignments:class_id", "fk_submission_assignment:3:assignment_version:assignments:version", "fk_submission_student:1:student_id:users:id"},
	"tasks":                  {"fk_task_submission:1:submission_id:submissions:id"},
	"task_outbox":            {"fk_outbox_task:1:task_id:tasks:id"},
	"submission_idempotency": {"fk_submission_replay:1:submission_id:submissions:id", "fk_submission_replay:2:assignment_id:submissions:assignment_id", "fk_submission_replay:3:class_id:submissions:class_id", "fk_submission_replay:4:user_id:submissions:student_id", "fk_task_replay:1:task_id:tasks:id", "fk_task_replay:2:submission_id:tasks:submission_id"},
}

func (e Executor) assignmentStructure(ctx context.Context, table string) error {
	var invalid int
	query := `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND (COLUMN_DEFAULT IS NOT NULL OR GENERATION_EXPRESSION<>'' OR (COLUMN_NAME<>'id' AND EXTRA<>'') OR (COLUMN_NAME IN ('title','description','answer') AND COLLATION_NAME<>'utf8mb4_0900_bin') OR (COLUMN_NAME IN ('worker_owner','route') AND COLLATION_NAME<>'ascii_bin'))`
	if e.DB.QueryRowContext(ctx, query, e.Database, table).Scan(&invalid) != nil || invalid != 0 {
		return ErrState
	}
	// A same-named table in another database is not the reviewed ownership
	// target. Reject it before Check or Repair can accept the schema as clean.
	query = `SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_SCHEMA IS NOT NULL AND REFERENCED_TABLE_SCHEMA<>TABLE_SCHEMA`
	if e.DB.QueryRowContext(ctx, query, e.Database, table).Scan(&invalid) != nil || invalid != 0 {
		return ErrState
	}
	query = `SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME=? AND (DELETE_RULE NOT IN ('NO ACTION','RESTRICT') OR UPDATE_RULE NOT IN ('NO ACTION','RESTRICT'))`
	if e.DB.QueryRowContext(ctx, query, e.Database, table).Scan(&invalid) != nil || invalid != 0 {
		return ErrState
	}
	// Prefix/descending/invisible/functional indexes must not impersonate the
	// complete binary idempotency key or the approved scheduling indexes.
	query = `SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND (SUB_PART IS NOT NULL OR INDEX_TYPE<>'BTREE' OR IS_VISIBLE<>'YES' OR EXPRESSION IS NOT NULL OR COLLATION<>'A')`
	if e.DB.QueryRowContext(ctx, query, e.Database, table).Scan(&invalid) != nil || invalid != 0 {
		return ErrState
	}
	actual, err := e.strings(ctx, `SELECT CONCAT(CONSTRAINT_NAME,':',ORDINAL_POSITION,':',COLUMN_NAME,':',REFERENCED_TABLE_NAME,':',REFERENCED_COLUMN_NAME) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL`, table)
	if err != nil || !equal(actual, assignmentTables[table]) {
		return ErrState
	}
	return nil
}
