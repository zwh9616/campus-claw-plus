package migrations

import (
	"context"
	"sort"
	"strings"
)

// Expected column order/types/nullability and every index/FK are checked before
// repairing dirty metadata. CREATE IF NOT EXISTS alone is not a schema check.
var columns = map[string]string{
	"users":              "id:bigint unsigned:NO,username:varchar(64):NO,password_hash:varchar(255):NO,role:enum('teacher','student'):NO,enabled:tinyint(1):NO,security_version:bigint:NO",
	"classes":            "id:bigint unsigned:NO,stable_key:varchar(64):NO,name:varchar(128):NO,active:tinyint(1):NO",
	"class_memberships":  "user_id:bigint unsigned:NO,class_id:bigint unsigned:NO,active:tinyint(1):NO",
	"sessions":           "id:char(32):NO,user_id:bigint unsigned:NO,class_id:bigint unsigned:NO,version:bigint:NO,security_version:bigint:NO,refresh_hash:binary(32):NO,refresh_expires:datetime(3):NO,revoked:tinyint(1):NO",
	"access_credentials": "token_hash:binary(32):NO,session_id:char(32):NO,session_version:bigint:NO,expires_at:datetime(3):NO",
	"auth_audit":         "id:bigint unsigned:NO,action:varchar(32):NO,result:varchar(16):NO,user_id:bigint unsigned:YES,session_id:char(32):YES,request_id:char(32):NO,occurred_at:datetime(3):NO",
}
var indexes = map[string][]string{
	"users":              {"PRIMARY:0:1:id", "uq_users_username:0:1:username"},
	"classes":            {"PRIMARY:0:1:id", "uq_classes_key:0:1:stable_key"},
	"class_memberships":  {"PRIMARY:0:1:user_id", "PRIMARY:0:2:class_id", "ix_membership_class:1:1:class_id"},
	"sessions":           {"PRIMARY:0:1:id", "uq_session_refresh:0:1:refresh_hash", "ix_session_user:1:1:user_id", "ix_session_class:1:1:class_id"},
	"access_credentials": {"PRIMARY:0:1:token_hash", "ix_access_session:1:1:session_id"},
	"auth_audit":         {"PRIMARY:0:1:id", "ix_audit_request:1:1:request_id", "ix_audit_time:1:1:occurred_at"},
}
var foreignKeys = map[string][]string{
	"class_memberships": {"class_id:classes:id", "user_id:users:id"}, "sessions": {"class_id:classes:id", "user_id:users:id"}, "access_credentials": {"session_id:sessions:id"},
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
	tables := []string{"users", "classes", "class_memberships"}
	if version >= 2 {
		tables = append(tables, "sessions", "access_credentials")
	}
	if version >= 3 {
		tables = append(tables, "auth_audit")
	}
	for _, table := range tables {
		var engine string
		if e.DB.QueryRowContext(ctx, "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?", e.Database, table).Scan(&engine) != nil || engine != "InnoDB" {
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
