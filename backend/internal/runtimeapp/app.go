// Package runtimeapp assembles the default identity/TXT/task HTTP application
// with an independent private document worker. It never performs DDL or opens
// the six still-frozen Document HTTP operations.
package runtimeapp

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/documentparser"
	"github.com/zwh9616/campus-claw-plus/backend/internal/documentqueue"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identityapp"
)

func New(ctx context.Context, lookup func(string) (string, bool), logger *slog.Logger) (http.Handler, func() error, error) {
	cfg, e := config.ReadDocumentParser(lookup)
	if e != nil {
		return nil, nil, e
	}
	client, e := documentparser.New(cfg.URL, cfg.Token)
	if e != nil {
		return nil, nil, e
	}
	handler, repo, e := identityapp.NewWithStore(ctx, lookup, logger)
	if e != nil {
		client.Close()
		return nil, nil, e
	}
	workerCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	queue := &documentqueue.Store{DB: repo.DB}
	parse := func(ctx context.Context, format string, data []byte) documentqueue.Result {
		r := client.Parse(ctx, format, data)
		locations := make([]documentqueue.Location, len(r.Locations))
		for i, p := range r.Locations {
			locations[i] = documentqueue.Location{Kind: p.Kind, Unit: p.Unit, Start: p.Start, End: p.End}
		}
		return documentqueue.Result{Status: r.Status, Body: r.Body, Failure: r.FailureReason, Pages: r.SourcePages, Locations: locations}
	}
	// No parser health RPC on startup or on old reads. Database failures are
	// supervised independently; they do not silently disable the worker forever
	// or stop identity/TXT HTTP. Every restart retains durable lease authority.
	go func() {
		defer close(done)
		for {
			if workerCtx.Err() != nil {
				return
			}
			err := queue.Run(workerCtx, parse)
			if workerCtx.Err() != nil {
				return
			}
			if err != nil {
				logger.Warn("document worker interrupted; retrying", "module", "document_worker", "request_id", nil)
			}
			timer := time.NewTimer(time.Second)
			select {
			case <-workerCtx.Done():
				timer.Stop()
				return
			case <-timer.C:
			}
		}
	}()
	var once sync.Once
	var closeError error
	closeApp := func() error {
		once.Do(func() { cancel(); client.Close(); <-done; closeError = repo.DB.Close() })
		return closeError
	}
	return handler, closeApp, nil
}
