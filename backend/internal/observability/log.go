package observability

import (
	"io"
	"log/slog"
	"strings"
	"time"
)

func NewLogger(output io.Writer) *slog.Logger {
	return slog.New(slog.NewJSONHandler(output, &slog.HandlerOptions{
		ReplaceAttr: func(_ []string, attr slog.Attr) slog.Attr {
			switch attr.Key {
			case slog.TimeKey:
				return slog.String("ts", attr.Value.Time().UTC().Format(time.RFC3339Nano))
			case slog.LevelKey:
				return slog.String("level", strings.ToLower(attr.Value.String()))
			case slog.MessageKey:
				return slog.String("message", attr.Value.String())
			}
			return attr
		},
	}))
}
