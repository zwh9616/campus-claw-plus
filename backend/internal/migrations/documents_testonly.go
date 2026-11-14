//go:build integration

package migrations

import (
	"context"
	"regexp"
	"strings"
)

// DownEmptyDocumentsForTest is absent from production binaries and the admin
// CLI. It is only for explicitly confirmed disposable integration databases.
// It leaves dirty6 metadata, so the test database cannot start an old server
// or masquerade as a completed operational rollback. Dispose of it afterwards.
func (e Executor) DownEmptyDocumentsForTest(ctx context.Context, confirmed string) error {
	if confirmed != e.Database || !regexp.MustCompile(`^idf_test_[0-9]+$`).MatchString(confirmed) {
		return ErrState
	}
	c, err := e.lock(ctx)
	if err != nil {
		return err
	}
	defer unlock(c)
	if e.Check(ctx, 6) != nil {
		return ErrState
	}
	for _, table := range documentTables {
		var n int
		if e.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM `"+table+"`").Scan(&n) != nil || n != 0 {
			return ErrState
		}
	}
	if _, err = e.DB.ExecContext(ctx, "UPDATE schema_migrations SET dirty=1 WHERE version=6"); err != nil {
		return ErrState
	}
	data, err := files.ReadFile("sql/000006_documents.down.sql")
	if err != nil {
		return ErrState
	}
	for _, statement := range strings.Split(string(data), ";") {
		if strings.TrimSpace(statement) == "" {
			continue
		}
		if _, err = e.DB.ExecContext(ctx, statement); err != nil {
			return ErrState
		}
	}
	return nil
}
