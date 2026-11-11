//go:build integration

package integration

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

// Queries execute against real MySQL. Only the commit response is injected;
// rolling back the real transaction keeps each failure fixture isolated.
type materialCommitConnector struct {
	driver.Connector
	commitError error
}

func (c materialCommitConnector) Connect(ctx context.Context) (driver.Conn, error) {
	conn, err := c.Connector.Connect(ctx)
	if err != nil {
		return nil, err
	}
	return materialCommitConn{conn, c.commitError}, nil
}

type materialCommitConn struct {
	driver.Conn
	commitError error
}

func (c materialCommitConn) BeginTx(ctx context.Context, options driver.TxOptions) (driver.Tx, error) {
	tx, err := c.Conn.(driver.ConnBeginTx).BeginTx(ctx, options)
	if err != nil {
		return nil, err
	}
	return materialCommitTx{tx, c.commitError}, nil
}

type materialCommitTx struct {
	driver.Tx
	commitError error
}

func (tx materialCommitTx) Commit() error {
	if err := tx.Tx.Rollback(); err != nil {
		return err
	}
	return tx.commitError
}

func TestMRCommitFailureDistinguishesUnavailableAndTimeout(t *testing.T) {
	ctx := context.Background()
	app, offline, name := database(t, 18)
	if err := (migrations.Executor{DB: offline, Database: name}).Up(ctx, 4); err != nil {
		t.Fatal("MR-SC-08 migration", err)
	}
	if err := (&mysqlstore.Store{DB: offline}).Initialize(ctx, seed(t), nil); err != nil {
		t.Fatal("initialize")
	}
	good := &mysqlstore.Store{DB: app}
	auth, err := identity.New(good, nil, "https://campus.test")
	if err != nil {
		t.Fatal(err)
	}
	teacher, err := auth.Login(ctx, "teacher-a", "test-only-teacher-a", strings.Repeat("a", 32))
	if err != nil {
		t.Fatal("login")
	}
	cfg, err := mysqlstore.Connector(strings.Replace(os.Getenv("MYSQL_DSN"), "/idf_test_0?", "/"+name+"?", 1), os.Getenv("MYSQL_CA_FILE"), false)
	if err != nil {
		t.Fatal("trusted connector")
	}
	connector, err := mysql.NewConnector(cfg)
	if err != nil {
		t.Fatal("connector")
	}
	upload, err := materials.PrepareUpload("commit failure", "test.txt", []byte("commit failure source"))
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name           string
		injected, want error
	}{
		{"unavailable", errors.New("commit connection lost"), identity.ErrUnavailable},
		{"timeout", context.DeadlineExceeded, identity.ErrTimeout},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := sql.OpenDB(materialCommitConnector{connector, tc.injected})
			defer db.Close()
			failing := &mysqlstore.Store{DB: db}
			before := count(t, offline, "materials")
			beforeKeys := count(t, offline, "material_idempotency")
			_, _, err := failing.CreateMaterial(ctx, teacher.Body.Principal, "create_commit_"+tc.name, upload)
			if !errors.Is(err, tc.want) {
				t.Errorf("MR-SC-05/08 create commit error = %v, want %v", err, tc.want)
			}
			if count(t, offline, "materials") != before || count(t, offline, "material_idempotency") != beforeKeys {
				t.Fatal("failed create left partial data")
			}
			pending, _, err := good.CreateMaterial(ctx, teacher.Body.Principal, "index_commit_"+tc.name, upload)
			if err != nil {
				t.Fatal("pending fixture")
			}
			_, err = failing.IndexMaterial(ctx, teacher.Body.Principal, pending.ID)
			if !errors.Is(err, tc.want) {
				t.Errorf("MR-SC-07/08 index commit error = %v, want %v", err, tc.want)
			}
			doc, err := good.GetMaterial(ctx, teacher.Body.Principal, pending.ID)
			if err != nil || doc.Material.IndexStatus != "pending" || count(t, offline, "material_chunks") != 0 {
				t.Fatal("failed index commit exposed partial chunks")
			}
		})
	}
}
