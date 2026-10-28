package observability

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// PB-07 / SC-17: non-request lines are JSON with a null request identifier.
func TestStartupLogJSON(t *testing.T) {
	var out bytes.Buffer
	NewLogger(&out).Info("server started", "module", "server", "request_id", nil)
	line := strings.TrimSpace(out.String())
	if strings.Contains(line, "\n") {
		t.Fatal("multiline log")
	}
	var entry map[string]any
	if err := json.Unmarshal([]byte(line), &entry); err != nil {
		t.Fatal(err)
	}
	if entry["request_id"] != nil || entry["message"] != "server started" || entry["level"] != "info" {
		t.Fatal(entry)
	}
	if _, err := time.Parse(time.RFC3339Nano, entry["ts"].(string)); err != nil {
		t.Fatal(err)
	}
}
