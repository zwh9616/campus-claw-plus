// Package identityapp assembles the active identity service after verifying TLS
// and offline migration state. It never performs DDL or reads migration credentials.
package identityapp

import (
	"context"
	"errors"
	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/httpserver"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
	"log/slog"
	"net/http"
	"time"
)

func New(ctx context.Context, lookup func(string) (string, bool), logger *slog.Logger) (http.Handler, func() error, error) {
	cfg, e := config.ReadIdentity(lookup)
	if e != nil {
		return nil, nil, e
	}
	db, e := mysqlstore.OpenEnvironment(lookup, false)
	if e != nil {
		return nil, nil, e
	}
	fail := func() (http.Handler, func() error, error) {
		db.Close()
		return nil, nil, errors.New("identity database startup check failed")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var name string
	if db.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&name) != nil {
		return fail()
	}
	if (migrations.Executor{DB: db, Database: name}).Check(ctx, 3) != nil {
		return fail()
	}
	repo := &mysqlstore.Store{DB: db}
	service, e := identity.New(repo, nil, cfg.Origin)
	if e != nil {
		return fail()
	}
	return httpserver.IdentityHandler(logger, service, repo, cfg, identity.NewLimiter(nil)), db.Close, nil
}
