package migrations

import (
	"context"
	"encoding/json"
	"regexp"
	"sort"
	"strings"
)

var documentTables = []string{"documents", "document_locations", "document_chunks", "document_parse_jobs", "document_idempotency"}
var documentAutoIncrement = regexp.MustCompile(`(?m)(\) ENGINE=InnoDB) AUTO_INCREMENT=[0-9]+`)

// document-structure.json is a committed canonical SHOW CREATE TABLE snapshot
// captured once from the reviewed, SHA-bound SQL on pinned MySQL 8.4.13. It is
// never learned from the database under inspection. Only the next generated ID
// is ignored: column/index/FK order, FK database, defaults, CHECK expressions,
// enforcement, collations and table options must match the approved definition.
func (e Executor) documentStructure(ctx context.Context, table string) error {
	data, err := files.ReadFile("document-structure.json")
	if err != nil {
		return ErrState
	}
	var expected map[string]string
	if json.Unmarshal(data, &expected) != nil || len(expected) != 5 || expected[table] == "" {
		return ErrState
	}
	var name, actual, engine, rowFormat string
	if e.DB.QueryRowContext(ctx, "SELECT ENGINE,ROW_FORMAT FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?", e.Database, table).Scan(&engine, &rowFormat) != nil || engine != "InnoDB" || rowFormat != "Dynamic" {
		return ErrState
	}
	// table is an internal exact allowlist value, never a request parameter.
	allowed := false
	for _, candidate := range documentTables {
		if table == candidate {
			allowed = true
		}
	}
	if !allowed {
		return ErrState
	}
	if e.DB.QueryRowContext(ctx, "SHOW CREATE TABLE `"+table+"`").Scan(&name, &actual) != nil || name != table {
		return ErrState
	}
	if canonicalDocumentDefinition(actual) != canonicalDocumentDefinition(expected[table]) {
		return ErrState
	}
	return nil
}

func canonicalDocumentDefinition(ddl string) string {
	ddl = documentAutoIncrement.ReplaceAllString(ddl, "${1}")
	var columns, rules []string
	for _, line := range strings.Split(ddl, "\n") {
		line = strings.TrimSuffix(line, ",")
		if strings.HasPrefix(line, "  PRIMARY KEY") || strings.HasPrefix(line, "  UNIQUE KEY") || strings.HasPrefix(line, "  KEY") || strings.HasPrefix(line, "  CONSTRAINT") {
			rules = append(rules, line)
		} else {
			columns = append(columns, strings.ReplaceAll(line, " ROW_FORMAT=DYNAMIC", ""))
		}
	}
	// Global declaration order carries no authority. Preserve every column
	// ordinal and each key/FK's internal column order and full CHECK syntax.
	sort.Strings(rules)
	return strings.Join(columns, "\n") + "\n" + strings.Join(rules, "\n")
}
