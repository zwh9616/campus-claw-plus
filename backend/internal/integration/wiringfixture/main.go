// Explicit test-only assembly for deploy/identity. Production cmd/server and
// the active skeleton probe are deliberately not switched by this subpackage.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/httpserver"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
	"github.com/zwh9616/campus-claw-plus/backend/internal/observability"
)

func main() {
	if run() != nil {
		fmt.Fprintln(os.Stderr, "isolated wiring fixture failed; configuration values omitted")
		os.Exit(1)
	}
}

func run() error {
	port, err := config.ReadPort(os.LookupEnv)
	if err != nil {
		return err
	}
	if len(os.Args) == 2 && os.Args[1] == "--healthcheck" {
		client := &http.Client{Timeout: 3500 * time.Millisecond}
		res, err := client.Get("http://127.0.0.1:" + port + "/health")
		if err != nil {
			return err
		}
		defer res.Body.Close()
		body, err := io.ReadAll(io.LimitReader(res.Body, 1024))
		var value struct {
			Status       string            `json:"status"`
			Dependencies map[string]string `json:"dependencies"`
		}
		if err != nil || json.Unmarshal(body, &value) != nil || res.StatusCode != 200 || value.Status != "ok" || len(value.Dependencies) != 1 || value.Dependencies["mysql"] != "up" || len(res.Header.Get("X-Request-ID")) != 32 {
			return fmt.Errorf("unhealthy identity fixture")
		}
		return nil
	}
	if len(os.Args) != 1 {
		return fmt.Errorf("unsupported argument")
	}
	cfg, err := config.ReadIdentity(os.LookupEnv)
	if err != nil {
		return err
	}
	db, err := mysqlstore.OpenEnvironment(os.LookupEnv, false)
	if err != nil {
		return err
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	var name string
	err = db.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&name)
	if err == nil {
		err = (migrations.Executor{DB: db, Database: name}).Check(ctx, 4)
	}
	cancel()
	if err != nil {
		return err
	}
	repo := &mysqlstore.Store{DB: db}
	svc, err := identity.New(repo, nil, cfg.Origin)
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp", net.JoinHostPort("0.0.0.0", port))
	if err != nil {
		return err
	}
	defer listener.Close()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return httpserver.Serve(ctx, listener, httpserver.IdentityHandler(observability.NewLogger(os.Stdout), svc, repo, cfg, identity.NewLimiter(nil)), observability.NewLogger(os.Stdout))
}
