// Package migrations implements IDF-SC-14/16: immutable SQL, dirty-state
// detection, and explicit forward repair. Server startup never performs DDL.
package migrations

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	migrate "github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	migratemysql "github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"io"
	"strings"
	"time"
)

//go:embed sql/*.sql manifest.json
var files embed.FS
var ErrState = errors.New("migration state requires inspection; no automatic repair")
var names = []string{"identity_users_classes", "identity_sessions", "identity_auth_audit", "materials_retrieval"}

type Executor struct {
	DB       *sql.DB
	Database string
	AfterDDL func(version, step int) error
}
type stepDriver struct {
	database.Driver
	db   *sql.DB
	hook func(int, int) error
}

func manifest() (map[string]string, error) {
	b, e := files.ReadFile("manifest.json")
	if e != nil {
		return nil, e
	}
	var m map[string]string
	e = json.Unmarshal(b, &m)
	return m, e
}
func verifyFiles() error {
	m, e := manifest()
	if e != nil {
		return ErrState
	}
	if len(m) != len(names)*2 {
		return ErrState
	}
	for i, n := range names {
		for _, dir := range []string{"up", "down"} {
			name := fmt.Sprintf("%06d_%s.%s.sql", i+1, n, dir)
			b, e := files.ReadFile("sql/" + name)
			if e != nil {
				return ErrState
			}
			sum := sha256.Sum256(b)
			if m[name] != hex.EncodeToString(sum[:]) {
				return ErrState
			}
		}
	}
	return nil
}
func (d *stepDriver) Run(r io.Reader) error {
	b, e := io.ReadAll(r)
	if e != nil {
		return ErrState
	}
	version := 0
	for i, n := range names {
		expected, _ := files.ReadFile(fmt.Sprintf("sql/%06d_%s.up.sql", i+1, n))
		if bytes.Equal(expected, b) {
			version = i + 1
		}
	}
	if version == 0 {
		return ErrState
	} // Production CLI has no destructive down path.
	step := 0
	for _, statement := range strings.Split(string(b), ";") {
		if strings.TrimSpace(statement) == "" {
			continue
		}
		step++
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		_, e = d.db.ExecContext(ctx, statement)
		cancel()
		if e != nil {
			return fmt.Errorf("migration %06d step %d failed", version, step)
		}
		if d.hook != nil {
			if e = d.hook(version, step); e != nil {
				return fmt.Errorf("migration %06d step %d interrupted", version, step)
			}
		}
	}
	return nil
}
func (e Executor) lock(ctx context.Context) (*sql.Conn, error) {
	c, err := e.DB.Conn(ctx)
	if err != nil {
		return nil, ErrState
	}
	var got int
	if err = c.QueryRowContext(ctx, "SELECT GET_LOCK('campus_identity_schema',10)").Scan(&got); err != nil || got != 1 {
		c.Close()
		return nil, ErrState
	}
	return c, nil
}
func unlock(c *sql.Conn) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	c.ExecContext(ctx, "SELECT RELEASE_LOCK('campus_identity_schema')")
	c.Close()
}
func (e Executor) driver() (*migrate.Migrate, *stepDriver, error) {
	conn, err := e.DB.Conn(context.Background())
	if err != nil {
		return nil, nil, ErrState
	}
	base, err := migratemysql.WithConnection(context.Background(), conn, &migratemysql.Config{DatabaseName: e.Database})
	if err != nil {
		conn.Close()
		return nil, nil, ErrState
	}
	d := &stepDriver{base, e.DB, e.AfterDDL}
	src, err := iofs.New(files, "sql")
	if err != nil {
		return nil, nil, ErrState
	}
	m, err := migrate.NewWithInstance("iofs", src, "mysql", d)
	if err != nil {
		return nil, nil, ErrState
	}
	m.LockTimeout = 10 * time.Second
	return m, d, nil
}
func checksum(v int) (string, string) {
	m, _ := manifest()
	base := fmt.Sprintf("%06d_%s", v, names[v-1])
	return m[base+".up.sql"], m[base+".down.sql"]
}
func (e Executor) record(ctx context.Context, v int) error {
	up, down := checksum(v)
	_, err := e.DB.ExecContext(ctx, "INSERT INTO identity_migration_checksums (version,up_sha256,down_sha256) VALUES (?,?,?)", v, up, down)
	if err != nil {
		return ErrState
	}
	return nil
}
func (e Executor) history(ctx context.Context, v int) error {
	rows, err := e.DB.QueryContext(ctx, "SELECT version,up_sha256,down_sha256 FROM identity_migration_checksums ORDER BY version")
	if err != nil {
		return ErrState
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		var version int
		var up, down string
		if rows.Scan(&version, &up, &down) != nil {
			return ErrState
		}
		n++
		if version != n || version > v || version < 1 || version > len(names) {
			return ErrState
		}
		a, b := checksum(version)
		if up != a || down != b {
			return ErrState
		}
	}
	if rows.Err() != nil || n != v {
		return ErrState
	}
	return nil
}
func (e Executor) Up(ctx context.Context, target int) error {
	if target < 1 || target > len(names) || verifyFiles() != nil {
		return ErrState
	}
	c, err := e.lock(ctx)
	if err != nil {
		return err
	}
	defer unlock(c)
	m, _, err := e.driver()
	if err != nil {
		return err
	}
	defer m.Close()
	// The metadata table holds no user data; missing history for an installed
	// version still fails history(), it is never reconstructed silently.
	if _, err = e.DB.ExecContext(ctx, "CREATE TABLE IF NOT EXISTS identity_migration_checksums (version BIGINT NOT NULL PRIMARY KEY,up_sha256 CHAR(64) CHARACTER SET ascii NOT NULL,down_sha256 CHAR(64) CHARACTER SET ascii NOT NULL) ENGINE=InnoDB"); err != nil {
		return ErrState
	}
	v, dirty, err := m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		v = 0
		err = nil
	}
	if err != nil || dirty || v > uint(target) {
		return ErrState
	}
	if err = e.history(ctx, int(v)); err != nil {
		return err
	}
	if v > 0 {
		if err = e.Structure(ctx, int(v)); err != nil {
			return err
		}
	}
	for i := int(v) + 1; i <= target; i++ {
		if err = m.Steps(1); err != nil {
			return ErrState
		}
		if err = e.Structure(ctx, i); err != nil {
			return err
		}
		if err = e.record(ctx, i); err != nil {
			return err
		}
	}
	return e.Check(ctx, target)
}
func (e Executor) Check(ctx context.Context, want int) error {
	if want < 1 || want > len(names) || verifyFiles() != nil {
		return ErrState
	}
	var v int
	var dirty bool
	if e.DB.QueryRowContext(ctx, "SELECT version,dirty FROM schema_migrations").Scan(&v, &dirty) != nil || v != want || dirty {
		return ErrState
	}
	if err := e.history(ctx, v); err != nil {
		return err
	}
	return e.Structure(ctx, v)
}

// Repair is an explicit operator action on a stopped, backed-up deployment.
// Only append-only CREATE statements are retried; incompatible existing tables
// are never altered/dropped. No force command is exposed to operators.
func (e Executor) Repair(ctx context.Context, version int) error {
	if version < 1 || version > len(names) || verifyFiles() != nil {
		return ErrState
	}
	c, err := e.lock(ctx)
	if err != nil {
		return err
	}
	defer unlock(c)
	m, d, err := e.driver()
	if err != nil {
		return err
	}
	defer m.Close()
	v, dirty, err := m.Version()
	if err != nil || v != uint(version) {
		return ErrState
	}
	// Earlier versions must be complete. The interrupted version may have its
	// exact checksum already recorded, but mismatched metadata always blocks.
	var count int
	if e.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM identity_migration_checksums WHERE version=?", version).Scan(&count) != nil {
		return ErrState
	}
	if count == 0 {
		if e.history(ctx, version-1) != nil {
			return ErrState
		}
	} else {
		if e.history(ctx, version) != nil {
			return ErrState
		}
	}
	if !dirty && count != 0 {
		return e.Check(ctx, version)
	}
	if version > 1 && e.Structure(ctx, version-1) != nil {
		return ErrState
	}
	if e.structure(ctx, version, true) != nil {
		return ErrState
	}
	b, _ := files.ReadFile(fmt.Sprintf("sql/%06d_%s.up.sql", version, names[version-1]))
	if err = d.Run(bytes.NewReader(b)); err != nil {
		return err
	}
	if err = e.Structure(ctx, version); err != nil {
		return err
	}
	if count == 0 {
		if err = e.record(ctx, version); err != nil {
			return err
		}
	}
	// Force is internal only, AFTER structure and immutable history agree.
	if err = m.Force(version); err != nil {
		return ErrState
	}
	return e.Check(ctx, version)
}
