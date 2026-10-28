package main

import (
	"context"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/httpserver"
	"github.com/zwh9616/campus-claw-plus/backend/internal/observability"
	"github.com/zwh9616/campus-claw-plus/backend/internal/probe"
)

func main() { os.Exit(run()) }

func run() int {
	logger := observability.NewLogger(os.Stdout)
	port, err := config.ReadPort(os.LookupEnv)
	if err != nil {
		logger.Error(err.Error(), "module", "config", "request_id", nil)
		return 2
	}
	if len(os.Args) > 1 {
		if len(os.Args) != 2 || os.Args[1] != "--healthcheck" {
			logger.Error("unsupported command argument", "module", "config", "request_id", nil)
			return 2
		}
		if err := probe.Check(context.Background(), "http://"+net.JoinHostPort("127.0.0.1", port)+"/health"); err != nil {
			logger.Error(err.Error(), "module", "probe", "request_id", nil)
			return 1
		}
		return 0
	}
	listener, err := net.Listen("tcp", net.JoinHostPort("0.0.0.0", port))
	if err != nil {
		logger.Error("HTTP_PORT listen failed", "module", "server", "request_id", nil)
		return 1
	}
	defer listener.Close()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	logger.Info("server started", "module", "server", "request_id", nil)
	if err := httpserver.Serve(ctx, listener, httpserver.Handler(logger), logger); err != nil {
		logger.Error("server stopped with error", "module", "server", "request_id", nil)
		return 1
	}
	logger.Info("server stopped", "module", "server", "request_id", nil)
	return 0
}
