package runtimeapp

import (
	"context"
	"io"
	"log/slog"
	"testing"
)

func TestInvalidParserConfigurationFailsBeforeDatabase(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	for _, values := range []map[string]string{{}, {"DOCUMENT_PARSER_URL": "http://document-parser:8091"}, {"DOCUMENT_PARSER_TOKEN": "bad"}} {
		h, close, e := New(context.Background(), func(k string) (string, bool) {
			if k != "DOCUMENT_PARSER_URL" && k != "DOCUMENT_PARSER_TOKEN" {
				t.Fatal("opened identity/database before parser config validation")
			}
			v, ok := values[k]
			return v, ok
		}, logger)
		if e == nil || h != nil || close != nil {
			t.Fatal("invalid runtime configuration accepted")
		}
	}
}
