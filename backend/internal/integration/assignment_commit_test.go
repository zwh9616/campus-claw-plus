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
	"github.com/zwh9616/campus-claw-plus/backend/internal/assignments"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

type atCommitConnector struct {
	driver.Connector
	commit bool
}

func (c atCommitConnector) Connect(ctx context.Context) (driver.Conn, error) {
	conn, e := c.Connector.Connect(ctx)
	return atCommitConn{conn, c.commit}, e
}

type atCommitConn struct {
	driver.Conn
	commit bool
}

func (c atCommitConn) BeginTx(ctx context.Context, options driver.TxOptions) (driver.Tx, error) {
	tx, e := c.Conn.(driver.ConnBeginTx).BeginTx(ctx, options)
	return atCommitTx{tx, c.commit}, e
}

type atCommitTx struct {
	driver.Tx
	commit bool
}

func (tx atCommitTx) Commit() error {
	var e error
	if tx.commit {
		e = tx.Tx.Commit()
	} else {
		e = tx.Tx.Rollback()
	}
	if e != nil {
		return e
	}
	return errors.New("controlled commit acknowledgement lost")
}
func TestATCommitAcknowledgementAndRealCommittedReplay(t *testing.T) {
	f := atBusinessSetup(t, 34)
	a := f.create(t, "commit")
	ctx := context.Background()
	cfg, e := mysqlstore.Connector(strings.Replace(os.Getenv("MYSQL_DSN"), "/idf_test_0?", "/idf_test_34?", 1), os.Getenv("MYSQL_CA_FILE"), false)
	if e != nil {
		t.Fatal("AT trusted test connector")
	}
	connector, e := mysql.NewConnector(cfg)
	if e != nil {
		t.Fatal("AT connector")
	}
	for _, commit := range []bool{false, true} {
		key := strings.Repeat("m", 16)
		if commit {
			key = strings.Repeat("n", 16)
		}
		db := sql.OpenDB(atCommitConnector{connector, commit})
		repo := &mysqlstore.Store{DB: db}
		before := atCounts(t, f.db)
		input := assignments.SubmitInput{Answer: "commit acknowledgement fixture", Version: assignments.Version{Value: 1}}
		_, e := repo.SubmitAssignment(ctx, f.users["student-a"].Body.Principal, a.ID, key, input, func() error { return nil })
		db.Close()
		if !errors.Is(e, identity.ErrTimeout) {
			t.Fatal("AT ambiguous commit did not return explicit504")
		}
		if !commit {
			atSameCounts(t, f.db, before)
			continue
		}
		after := atCounts(t, f.db)
		for i, n := range before {
			if after[i] != n+1 {
				t.Fatal("AT actual commit not atomic")
			}
		}
		replay, e := f.repo.SubmitAssignment(ctx, f.users["student-a"].Body.Principal, a.ID, key, input, func() error { t.Fatal("AT committed replay reentered new quota"); return nil })
		if e != nil || replay.Status != "pending" {
			t.Fatal("AT lost acknowledgement replay did not query durable fact")
		}
		atSameCounts(t, f.db, after)
	}
}
