//go:build integration && documentruntime

package wiring

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/documentqueue"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

// DI-SC-03..07/10/14: only trusted fixture insertion is used here. The actual
// default server worker, private Python image and TLS database produce results;
// this is deliberately not evidence for the still-frozen authorized HTTP API.
func TestDocumentProductionWorker(t *testing.T) {
	raw, err := os.ReadFile("/fixtures/backend.env")
	if err != nil {
		t.Fatal("fixture inputs unavailable")
	}
	values := map[string]string{}
	for _, line := range strings.Split(string(raw), "\n") {
		if k, v, ok := strings.Cut(line, "="); ok {
			decoded, e := strconv.Unquote(v)
			if e != nil {
				t.Fatal("fixture encoding")
			}
			values[k] = decoded
		}
	}
	db, err := mysqlstore.Open(values["MYSQL_DSN"], values["MYSQL_CA_FILE"], false)
	if err != nil {
		t.Fatal("trusted fixture database unavailable")
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 110*time.Second)
	defer cancel()
	queue := &documentqueue.Store{DB: db}
	var user, class uint64
	if db.QueryRowContext(ctx, "SELECT id FROM users WHERE username='wiring-teacher'").Scan(&user) != nil || db.QueryRowContext(ctx, "SELECT id FROM classes WHERE stable_key='wiring-a'").Scan(&class) != nil {
		t.Fatal("trusted fixture identity")
	}
	var manifest struct {
		Cases []struct {
			File, Format, SHA256 string
			Bytes                int
			Gold                 []struct {
				Kind string
				Unit int
				Text string
			}
		}
	}
	raw, err = os.ReadFile("/corpus/manifest.json")
	if err != nil || json.Unmarshal(raw, &manifest) != nil || len(manifest.Cases) != 40 {
		t.Fatal("frozen corpus manifest")
	}
	state := map[string]any{}
	path := "/fixtures/document-worker-proof.json"
	if raw, e := os.ReadFile(path); e == nil && len(raw) > 0 {
		if json.Unmarshal(raw, &state) != nil {
			t.Fatal("proof encoding")
		}
	}
	stage := os.Getenv("DOCUMENT_WORKER_STAGE")
	upload := func(index int, key string) documentqueue.Upload {
		c := manifest.Cases[index]
		data, e := os.ReadFile(filepath.Join("/corpus", c.File))
		if e != nil {
			t.Fatal("corpus original")
		}
		digest := sha256.Sum256(data)
		if len(data) != c.Bytes || hex.EncodeToString(digest[:]) != c.SHA256 {
			t.Fatal("frozen corpus bytes drift")
		}
		return documentqueue.Upload{UserID: user, ClassID: class, Key: key, Title: c.File, Format: c.Format, Original: data}
	}
	enqueue := func(u documentqueue.Upload) documentqueue.Accepted {
		a, e := queue.Enqueue(ctx, u)
		if e != nil {
			t.Fatal("trusted enqueue", e)
		}
		return a
	}
	wait := func(id uint64, want string, wantAttempts int) {
		for ctx.Err() == nil {
			var status string
			var attempts int
			if e := db.QueryRowContext(ctx, "SELECT status,attempts FROM documents WHERE id=?", id).Scan(&status, &attempts); e != nil {
				t.Fatal("durable document read")
			}
			if status == want && attempts == wantAttempts {
				return
			}
			if status == "failed" && want != "failed" {
				t.Fatal("unexpected durable failure")
			}
			time.Sleep(100 * time.Millisecond)
		}
		t.Fatal("production worker did not reach expected durable state")
	}
	validate := func(index int, a documentqueue.Accepted, wantAttempts int) (int, int) {
		wait(a.ID, "ready", wantAttempts)
		c := manifest.Cases[index]
		var original, digest []byte
		var body string
		var pages *int
		if e := db.QueryRowContext(ctx, "SELECT original_bytes,original_digest,body,page_count FROM documents WHERE id=?", a.ID).Scan(&original, &digest, &body, &pages); e != nil {
			t.Fatal("persisted result")
		}
		h := sha256.Sum256(original)
		if hex.EncodeToString(h[:]) != c.SHA256 || !bytes.Equal(h[:], digest) {
			t.Fatal("original bytes/digest changed")
		}
		if c.Format == "pdf" && (pages == nil || *pages < 1) || c.Format == "docx" && pages != nil {
			t.Fatal("page count format")
		}
		runes := []rune(body)
		rows, e := db.QueryContext(ctx, "SELECT kind,unit,char_start,char_end FROM document_locations WHERE document_id=? ORDER BY unit", a.ID)
		if e != nil {
			t.Fatal("persisted locations")
		}
		locations := 0
		for rows.Next() {
			var kind string
			var unit, start, end int
			if rows.Scan(&kind, &unit, &start, &end) != nil {
				t.Fatal("location row")
			}
			if locations >= len(c.Gold) {
				t.Fatal("extra location")
			}
			g := c.Gold[locations]
			if kind != g.Kind || unit != g.Unit || start < 0 || end <= start || end > len(runes) || strings.Join(strings.Fields(string(runes[start:end])), " ") != strings.Join(strings.Fields(g.Text), " ") {
				t.Fatal("persisted gold location/body mismatch")
			}
			locations++
		}
		if rows.Err() != nil || rows.Close() != nil || locations != len(c.Gold) {
			t.Fatal("missing gold locations")
		}
		rows, e = db.QueryContext(ctx, "SELECT c.unit,c.ordinal,c.char_start,c.char_end,c.quote,l.char_start,l.char_end FROM document_chunks c JOIN document_locations l USING(document_id,class_id,document_version,unit) WHERE c.document_id=? ORDER BY c.unit,c.ordinal", a.ID)
		if e != nil {
			t.Fatal("persisted chunks")
		}
		chunks, units, lastUnit, lastOrdinal, lastEnd, lastHi := 0, 0, 0, 0, 0, 0
		for rows.Next() {
			var unit, ordinal, start, end, lo, hi int
			var quote string
			if rows.Scan(&unit, &ordinal, &start, &end, &quote, &lo, &hi) != nil {
				t.Fatal("chunk row")
			}
			if start < lo || end > hi || end <= start || end-start > 2000 || end > len(runes) || quote != string(runes[start:end]) {
				t.Fatal("quote differs from persisted codepoints")
			}
			if unit != lastUnit {
				if lastUnit != 0 && lastEnd != lastHi {
					t.Fatal("chunk coverage")
				}
				if ordinal != 1 || start != lo {
					t.Fatal("chunk start")
				}
				lastOrdinal = 0
				units++
			} else if ordinal != lastOrdinal+1 || start != lastEnd-200 {
				t.Fatal("chunk overlap/order")
			}
			lastUnit, lastOrdinal, lastEnd = unit, ordinal, end
			lastHi = hi
			chunks++
		}
		if rows.Err() != nil || rows.Close() != nil || chunks < locations || units != locations || lastEnd != lastHi {
			t.Fatal("chunk coverage")
		}
		var closed int
		if db.QueryRowContext(ctx, "SELECT COUNT(*) FROM document_parse_jobs WHERE document_id=? AND delivery_state='closed' AND worker_owner IS NULL AND lease_until IS NULL", a.ID).Scan(&closed) != nil || closed != 1 {
			t.Fatal("job not atomically closed")
		}
		u := upload(index, fmt.Sprintf("runtime_corpus_%02d", index))
		if stage != "corpus" {
			u = upload(index, "runtime_"+strings.Split(stage, "-")[0]+"_document")
		}
		replay, e := queue.Enqueue(ctx, u)
		if e != nil || !replay.Replay || replay.ID != a.ID || !bytes.Equal(a.Body, replay.Body) {
			t.Fatal("original 202 snapshot changed")
		}
		return locations, chunks
	}
	switch stage {
	case "database-verify":
		a := enqueue(upload(0, "runtime_database_document"))
		l, c := validate(0, a, 1)
		state[stage] = map[string]any{"attempts": 1, "locations": l, "chunks": c, "original_202_replay": true}
	case "corpus":
		locations, chunks := 0, 0
		for i := range manifest.Cases {
			a := enqueue(upload(i, fmt.Sprintf("runtime_corpus_%02d", i)))
			l, c := validate(i, a, 1)
			locations += l
			chunks += c
		}
		if locations != 195 {
			t.Fatal("gold location total")
		}
		state[stage] = map[string]any{"documents": 40, "locations": locations, "chunks": chunks, "persisted_gold_text": true, "exact_quote_codepoints": true, "original_202_replay": true}
	case "outage-enqueue", "restart-enqueue", "kill-enqueue":
		name := strings.Split(stage, "-")[0]
		a := enqueue(upload(0, "runtime_"+name+"_document"))
		state[name+"_accepted"] = a
		if name == "outage" {
			wait(a.ID, "failed", 1)
			var reason string
			if db.QueryRowContext(ctx, "SELECT failure_reason FROM documents WHERE id=?", a.ID).Scan(&reason) != nil || reason != "worker_interrupted" {
				t.Fatal("outage result")
			}
		}
		if name == "restart" {
			wait(a.ID, "queued", 0)
		}
		if name == "kill" {
			wait(a.ID, "processing", 1)
		}
		state[stage] = true
	case "outage-retry", "restart-verify", "kill-expire", "kill-verify":
		name := strings.Split(stage, "-")[0]
		var a documentqueue.Accepted
		raw, e := json.Marshal(state[name+"_accepted"])
		if e != nil || json.Unmarshal(raw, &a) != nil || a.ID == 0 {
			t.Fatal("durable fixture proof")
		}
		if stage == "kill-expire" {
			var leased int
			if db.QueryRowContext(ctx, "SELECT COUNT(*) FROM document_parse_jobs WHERE document_id=? AND delivery_state='leased' AND execution_epoch=1 AND lease_until>UTC_TIMESTAMP(3)", a.ID).Scan(&leased) != nil || leased != 1 {
				t.Fatal("actual killed process lost durable lease")
			}
			// Only this disposable fixture advances expiry; production lease remains60s.
			if _, e = db.ExecContext(ctx, "UPDATE document_parse_jobs SET lease_until=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE document_id=?", a.ID); e != nil {
				t.Fatal("fixture expiry")
			}
			state[stage] = true
			break
		}
		attempts := 1
		if name != "restart" {
			attempts = 2
		}
		if name == "outage" {
			if e = queue.Retry(ctx, a.ID, class); e != nil {
				t.Fatal("explicit fixture retry", e)
			}
		}
		l, c := validate(0, a, attempts)
		state[stage] = map[string]any{"attempts": attempts, "locations": l, "chunks": c, "original_202_replay": true}
		if name == "kill" {
			var epoch int
			if db.QueryRowContext(ctx, "SELECT execution_epoch FROM document_parse_jobs WHERE document_id=?", a.ID).Scan(&epoch) != nil || epoch != 2 {
				t.Fatal("epoch takeover")
			}
		}
	default:
		t.Fatal("unknown trusted fixture stage")
	}
	raw, err = json.Marshal(state)
	if err != nil || os.WriteFile(path, raw, 0600) != nil {
		t.Fatal("sanitized proof unavailable")
	}
	t.Log("actual default worker durable stage passed:", stage)
}
