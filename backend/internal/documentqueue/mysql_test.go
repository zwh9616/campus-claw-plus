//go:build documentqueue

package documentqueue

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	osexec "os/exec"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// This suite runs only inside the owned candidate-DDL probe network namespace.
// Missing credentials fail instead of silently skipping an integration test.
func testDB(t *testing.T) *sql.DB {
	t.Helper()
	password := os.Getenv("MYSQL_PWD")
	if password == "" {
		t.Fatal("isolated database credential missing")
	}
	db, e := sql.Open("mysql", "root:"+password+"@tcp(127.0.0.1:3306)/di_contract_probe?parseTime=true&loc=UTC&charset=utf8mb4&timeout=2s&readTimeout=5s&writeTimeout=5s")
	if e != nil {
		t.Fatal("open isolated database")
	}
	db.SetMaxOpenConns(25)
	t.Cleanup(func() { db.Close() })
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if db.PingContext(ctx) != nil {
		t.Fatal("isolated database unavailable")
	}
	return db
}
func clean(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, table := range []string{"document_idempotency", "document_parse_jobs", "document_chunks", "document_locations", "documents"} {
		if _, e := db.Exec("DELETE FROM " + table); e != nil {
			t.Fatal("clean owned fixture", table)
		}
	}
}
func upload(key string) Upload {
	return Upload{1, 1, key, "课程😀", "pdf", []byte("%PDF-fixture-source")}
}
func enqueue(t *testing.T, s *Store, key string) Accepted {
	t.Helper()
	a, e := s.Enqueue(context.Background(), upload(key))
	if e != nil {
		t.Fatal("enqueue", e)
	}
	return a
}
func claim(t *testing.T, s *Store, id uint64) Work {
	t.Helper()
	owner, e := NewOwner()
	if e != nil {
		t.Fatal(e)
	}
	w, e := s.Claim(context.Background(), id, owner)
	if e != nil {
		t.Fatal("claim", e)
	}
	return w
}
func expire(t *testing.T, db *sql.DB, id uint64) {
	t.Helper()
	if _, e := db.Exec("UPDATE document_parse_jobs SET lease_until=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE document_id=?", id); e != nil {
		t.Fatal(e)
	}
}
func goodResult() Result {
	p := 2
	return Result{Status: "ready", Body: "课程😀\n\n第二页", Pages: &p, Locations: []Location{{"pdf_page", 1, 0, 3}, {"pdf_page", 2, 5, 8}}}
}
func count(t *testing.T, db *sql.DB, table string) int {
	t.Helper()
	var n int
	if db.QueryRow("SELECT COUNT(*) FROM "+table).Scan(&n) != nil {
		t.Fatal("count", table)
	}
	return n
}
func state(t *testing.T, db *sql.DB, id uint64, want string, attempt int, delivery string) {
	t.Helper()
	var st, d string
	var a int
	if db.QueryRow("SELECT d.status,d.attempts,j.delivery_state FROM documents d JOIN document_parse_jobs j ON j.document_id=d.id WHERE d.id=?", id).Scan(&st, &a, &d) != nil || st != want || a != attempt || d != delivery {
		t.Fatalf("state got %s/%d/%s want %s/%d/%s", st, a, d, want, attempt, delivery)
	}
}

func TestMySQLConcurrentAcceptance(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	s := &Store{DB: db}
	ctx := context.Background()
	var wg sync.WaitGroup
	start := make(chan struct{})
	answers := make(chan Accepted, 20)
	errs := make(chan error, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			a, e := s.Enqueue(ctx, upload("parallel_same_0001"))
			answers <- a
			errs <- e
		}()
	}
	close(start)
	wg.Wait()
	close(answers)
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal("20-way same-key", e)
		}
	}
	var first Accepted
	created := 0
	for a := range answers {
		if first.ID == 0 {
			first = a
		}
		if a.ID != first.ID || !bytes.Equal(a.Body, first.Body) {
			t.Fatal("original response differed")
		}
		if !a.Replay {
			created++
		}
	}
	if created != 1 || count(t, db, "documents") != 1 || count(t, db, "document_parse_jobs") != 1 || count(t, db, "document_idempotency") != 1 {
		t.Fatal("duplicate durable acceptance")
	}
	state(t, db, first.ID, "queued", 0, "pending")
	var body map[string]any
	if json.Unmarshal(first.Body, &body) != nil || len(body) != 11 || body["status"] != "queued" || body["id"] != fmt.Sprint(first.ID) {
		t.Fatal("202 snapshot shape")
	}
	w := claim(t, s, first.ID)
	if s.Finish(ctx, w, goodResult()) != nil {
		t.Fatal("publish")
	}
	// Simulate a lost 202 receipt: rediscover from a new Store after processing.
	restarted := &Store{DB: db}
	r, found, e := restarted.Replay(ctx, upload("parallel_same_0001"))
	if e != nil || !found || !bytes.Equal(r.Body, first.Body) {
		t.Fatal("receipt recovery changed original202")
	}
	u := upload("parallel_same_0001")
	u.Original = append(u.Original, 'x')
	if _, e = s.Enqueue(ctx, u); !errors.Is(e, ErrConflict) {
		t.Fatal("same key changed payload")
	}
	if _, found, e = s.Replay(ctx, u); !found || !errors.Is(e, ErrConflict) {
		t.Fatal("replay payload conflict")
	}
	// Keys are byte exact, independently scoped by class and authenticated user.
	for _, u := range []Upload{upload("PARALLEL_same_0001"), {2, 1, "parallel_same_0001", "课程😀", "pdf", []byte("%PDF-fixture-source")}, {1, 2, "parallel_same_0001", "课程😀", "pdf", []byte("%PDF-fixture-source")}} {
		if _, e = s.Enqueue(ctx, u); e != nil {
			t.Fatal("scope", e)
		}
	}
	if count(t, db, "documents") != 4 {
		t.Fatal("scoped keys collapsed")
	}
}

func TestMySQLAcceptanceRollbackAndMixedPayload(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	ctx := context.Background()
	injected := errors.New("controlled boundary")
	for _, stage := range []string{"enqueue-document", "enqueue-job", "enqueue-snapshot"} {
		s := &Store{DB: db, Hook: func(at string) error {
			if at == stage {
				return injected
			}
			return nil
		}}
		if _, e := s.Enqueue(ctx, upload("rollback_source_01")); !errors.Is(e, injected) {
			t.Fatal(stage, e)
		}
		for _, table := range []string{"documents", "document_parse_jobs", "document_idempotency"} {
			if count(t, db, table) != 0 {
				t.Fatal("partial acceptance", stage, table)
			}
		}
	}
	s := &Store{DB: db}
	var wg sync.WaitGroup
	var accepted, conflicts atomic.Int32
	start := make(chan struct{})
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			u := upload("parallel_mixed_01")
			u.Title = fmt.Sprint("课程", i%2)
			_, e := s.Enqueue(ctx, u)
			if e == nil {
				accepted.Add(1)
			} else if errors.Is(e, ErrConflict) {
				conflicts.Add(1)
			} else {
				t.Error("mixed payload", e)
			}
		}(i)
	}
	close(start)
	wg.Wait()
	if accepted.Load() != 10 || conflicts.Load() != 10 || count(t, db, "documents") != 1 {
		t.Fatal("mixed-key serialization", accepted.Load(), conflicts.Load())
	}
}

func TestMySQLLeaseCASAndExhaustion(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	s := &Store{DB: db}
	ctx := context.Background()
	a := enqueue(t, s, "lease_source_0001")
	var wg sync.WaitGroup
	var wins atomic.Int32
	works := make(chan Work, 20)
	start := make(chan struct{})
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			owner, _ := NewOwner()
			w, e := s.Claim(ctx, a.ID, owner)
			if e == nil {
				wins.Add(1)
				works <- w
			} else if !errors.Is(e, ErrLost) {
				t.Error(e)
			}
		}()
	}
	close(start)
	wg.Wait()
	close(works)
	if wins.Load() != 1 {
		t.Fatal("claim was not exclusive")
	}
	old := <-works
	for i := 0; i < 3; i++ {
		if s.Renew(ctx, old.Lease) != nil {
			t.Fatal("live heartbeat")
		}
	}
	for _, l := range []Lease{{old.ID, old.ClassID, old.Epoch + 1, old.Owner}, {old.ID, old.ClassID + 1, old.Epoch, old.Owner}, {old.ID, old.ClassID, old.Epoch, strings.Repeat("f", 32)}} {
		if !errors.Is(s.Renew(ctx, l), ErrLost) {
			t.Fatal("forged authority renewed")
		}
		bad := old
		bad.Lease = l
		if !errors.Is(s.Finish(ctx, bad, goodResult()), ErrLost) {
			t.Fatal("forged authority published")
		}
	}
	expire(t, db, a.ID)
	if !errors.Is(s.Renew(ctx, old.Lease), ErrLost) || !errors.Is(s.Finish(ctx, old, goodResult()), ErrLost) {
		t.Fatal("expired authority accepted")
	}
	second := claim(t, s, a.ID)
	if second.Epoch != old.Epoch+1 || !bytes.Equal(second.Original, old.Original) {
		t.Fatal("takeover epoch/source")
	}
	if !errors.Is(s.Finish(ctx, old, goodResult()), ErrLost) {
		t.Fatal("old owner overwrote takeover")
	}
	expire(t, db, a.ID)
	third := claim(t, s, a.ID)
	expire(t, db, a.ID)
	owner, _ := NewOwner()
	if _, e := s.Claim(ctx, a.ID, owner); !errors.Is(e, ErrExhausted) {
		t.Fatal("fourth claim", e)
	}
	state(t, db, a.ID, "failed", 3, "closed")
	if !errors.Is(s.Finish(ctx, third, goodResult()), ErrLost) || !errors.Is(s.Retry(ctx, a.ID, 1), ErrConflict) {
		t.Fatal("exhaustion escaped")
	}
	var epoch int
	var reason string
	if db.QueryRow("SELECT j.execution_epoch,d.failure_reason FROM document_parse_jobs j JOIN documents d ON d.id=j.document_id WHERE d.id=?", a.ID).Scan(&epoch, &reason) != nil || epoch != 3 || reason != "worker_interrupted" {
		t.Fatal("exhausted state")
	}
}

func TestMySQLAtomicPublicationAndSource(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	ctx := context.Background()
	s := &Store{DB: db}
	a := enqueue(t, s, "publish_source_01")
	w := claim(t, s, a.ID)
	for _, stage := range []string{"finish-locked", "finish-chunk", "finish-document", "finish-job"} {
		s.Hook = func(at string) error {
			if at == stage {
				return ErrUnavailable
			}
			return nil
		}
		if !errors.Is(s.Finish(ctx, w, goodResult()), ErrUnavailable) {
			t.Fatal(stage)
		}
		state(t, db, a.ID, "processing", 1, "leased")
		if count(t, db, "document_locations") != 0 || count(t, db, "document_chunks") != 0 {
			t.Fatal("partial index escaped", stage)
		}
	}
	s.Hook = nil
	if _, e := db.Exec("UPDATE documents SET original_digest=? WHERE id=?", make([]byte, 32), a.ID); e != nil {
		t.Fatal(e)
	}
	if !errors.Is(s.Finish(ctx, w, goodResult()), ErrUnavailable) {
		t.Fatal("corrupt digest accepted")
	}
	if count(t, db, "document_locations") != 0 {
		t.Fatal("corrupt publication")
	}
	d := sha256.Sum256(w.Original)
	db.Exec("UPDATE documents SET original_digest=? WHERE id=?", d[:], a.ID)
	if e := s.Finish(ctx, w, goodResult()); e != nil {
		t.Fatal("good publication", e)
	}
	state(t, db, a.ID, "ready", 1, "closed")
	rows, e := db.Query("SELECT c.quote,c.char_start,c.char_end,l.kind,l.unit FROM document_chunks c JOIN document_locations l ON l.document_id=c.document_id AND l.class_id=c.class_id AND l.document_version=c.document_version AND l.unit=c.unit ORDER BY c.id")
	if e != nil {
		t.Fatal(e)
	}
	defer rows.Close()
	n := 0
	text := []rune(goodResult().Body)
	for rows.Next() {
		var quote, kind string
		var start, end, unit int
		if rows.Scan(&quote, &start, &end, &kind, &unit) != nil || quote != string(text[start:end]) || kind != "pdf_page" || unit != n+1 {
			t.Fatal("wrong durable Unicode quote")
		}
		n++
	}
	if rows.Err() != nil || n != 2 {
		t.Fatal("missing persisted pages")
	}
	if !errors.Is(s.Finish(ctx, w, goodResult()), ErrLost) {
		t.Fatal("double finish")
	}
}

func TestMySQLLongChunksAndRetry(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	ctx := context.Background()
	s := &Store{DB: db}
	u := upload("long_source_0001")
	u.Format = "docx"
	a, e := s.Enqueue(ctx, u)
	if e != nil {
		t.Fatal(e)
	}
	w := claim(t, s, a.ID)
	r := Result{Status: "ready", Body: strings.Repeat("😀", 3801), Locations: []Location{{"docx_table_cell", 7, 0, 3801}}}
	if e = s.Finish(ctx, w, r); e != nil {
		t.Fatal(e)
	}
	rows, e := db.Query("SELECT ordinal,char_start,char_end,CHAR_LENGTH(quote) FROM document_chunks WHERE document_id=? ORDER BY ordinal", a.ID)
	if e != nil {
		t.Fatal(e)
	}
	want := [][4]int{{1, 0, 2000, 2000}, {2, 1800, 3800, 2000}, {3, 3600, 3801, 201}}
	i := 0
	for rows.Next() {
		var got [4]int
		rows.Scan(&got[0], &got[1], &got[2], &got[3])
		if i >= len(want) || got != want[i] {
			t.Fatal("chunk boundary", got)
		}
		i++
	}
	rows.Close()
	if i != 3 {
		t.Fatal("chunk count")
	}
	for _, reason := range []string{"corrupt", "encrypted", "unsupported_content", "resource_limit", "parse_timeout", "worker_interrupted", "internal_failure"} {
		a := enqueue(t, s, "retry_"+reason+strings.Repeat("0", 16))
		w := claim(t, s, a.ID)
		if s.Finish(ctx, w, Result{Status: "failed", Failure: reason}) != nil {
			t.Fatal("failure result")
		}
		e := s.Retry(ctx, a.ID, 1)
		if reason == "parse_timeout" || reason == "worker_interrupted" || reason == "internal_failure" {
			if e != nil {
				t.Fatal("retryable", e)
			}
			state(t, db, a.ID, "queued", 1, "pending")
			if !errors.Is(s.Retry(ctx, a.ID, 1), ErrConflict) {
				t.Fatal("duplicate retry")
			}
			next := claim(t, s, a.ID)
			if next.Epoch != w.Epoch+1 {
				t.Fatal("retry lost epoch")
			}
		} else if !errors.Is(e, ErrConflict) {
			t.Fatal("deterministic retry", reason, e)
		}
	}
	ocr := enqueue(t, s, "ocr_source_00001")
	ow := claim(t, s, ocr.ID)
	pages := 4
	if s.Finish(ctx, ow, Result{Status: "needs_ocr", Pages: &pages}) != nil || !errors.Is(s.Retry(ctx, ocr.ID, 1), ErrConflict) {
		t.Fatal("OCR publication/retry")
	}
}

func TestMySQLClaimAndRetryRollback(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	ctx := context.Background()
	s := &Store{DB: db}
	a := enqueue(t, s, "rollback_claim_01")
	for _, stage := range []string{"claim-document", "claim-job"} {
		s.Hook = func(at string) error {
			if at == stage {
				return ErrUnavailable
			}
			return nil
		}
		owner, _ := NewOwner()
		if _, e := s.Claim(ctx, a.ID, owner); !errors.Is(e, ErrUnavailable) {
			t.Fatal(stage, e)
		}
		state(t, db, a.ID, "queued", 0, "pending")
	}
	s.Hook = nil
	w := claim(t, s, a.ID)
	if s.Finish(ctx, w, Result{Status: "failed", Failure: "parse_timeout"}) != nil {
		t.Fatal("fail")
	}
	s.Hook = func(stage string) error {
		if stage == "retry-document" {
			return ErrUnavailable
		}
		return nil
	}
	if !errors.Is(s.Retry(ctx, a.ID, 1), ErrUnavailable) {
		t.Fatal("retry rollback")
	}
	state(t, db, a.ID, "failed", 1, "closed")
	s.Hook = nil
	var wg sync.WaitGroup
	var wins atomic.Int32
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			e := s.Retry(ctx, a.ID, 1)
			if e == nil {
				wins.Add(1)
			} else if !errors.Is(e, ErrConflict) {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	if wins.Load() != 1 {
		t.Fatal("retry CAS", wins.Load())
	}
}

func TestMySQLWorkerSingleFlightAndCancellation(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	s := &Store{DB: db}
	enqueue(t, s, "worker_source_01")
	enqueue(t, s, "worker_source_02")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var active, max, calls atomic.Int32
	done := make(chan error, 1)
	go func() {
		done <- s.run(ctx, func(ctx context.Context, _ string, _ []byte) Result {
			n := active.Add(1)
			if n > max.Load() {
				max.Store(n)
			}
			defer active.Add(-1)
			calls.Add(1)
			time.Sleep(65 * time.Millisecond)
			return goodResult()
		}, 5*time.Millisecond, 10*time.Millisecond)
	}()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		var n int
		db.QueryRow("SELECT COUNT(*) FROM documents WHERE status='ready'").Scan(&n)
		if n == 2 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	if e := <-done; e != nil {
		t.Fatal(e)
	}
	if calls.Load() != 2 || max.Load() != 1 {
		t.Fatal("single flight", calls.Load(), max.Load())
	}
	a := enqueue(t, s, "cancel_source_01")
	ctx2, cancel2 := context.WithCancel(context.Background())
	entered := make(chan struct{})
	exited := make(chan struct{})
	done = make(chan error, 1)
	go func() {
		done <- s.run(ctx2, func(ctx context.Context, _ string, _ []byte) Result {
			close(entered)
			<-ctx.Done()
			close(exited)
			return goodResult()
		}, 5*time.Millisecond, 10*time.Millisecond)
	}()
	<-entered
	cancel2()
	if e := <-done; e != nil {
		t.Fatal(e)
	}
	<-exited
	state(t, db, a.ID, "processing", 1, "leased")
	expire(t, db, a.ID)
	newWork := claim(t, s, a.ID)
	if s.Finish(context.Background(), newWork, goodResult()) != nil {
		t.Fatal("cancel recovery")
	}
}

func TestMySQLProcessCrashRecovery(t *testing.T) {
	if os.Getenv("CAMPUS_DOCUMENT_CRASH_CHILD") == "1" {
		db := testDB(t)
		s := &Store{DB: db}
		ids, e := s.Ready(context.Background())
		if e != nil || len(ids) != 1 {
			t.Fatal("child ready")
		}
		w := claim(t, s, ids[0])
		fmt.Println("CLAIMED", w.ID, w.Epoch)
		select {}
	}
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	s := &Store{DB: db}
	a := enqueue(t, s, "crash_source_001")
	cmd := osexec.Command(os.Args[0], "-test.run=^TestMySQLProcessCrashRecovery$", "-test.timeout=20s")
	cmd.Env = append(os.Environ(), "CAMPUS_DOCUMENT_CRASH_CHILD=1")
	pipe, e := cmd.StdoutPipe()
	if e != nil {
		t.Fatal(e)
	}
	if cmd.Start() != nil {
		t.Fatal("start actual worker process")
	}
	defer func() {
		if cmd.ProcessState == nil {
			cmd.Process.Kill()
			cmd.Wait()
		}
	}()
	buf := make([]byte, 256)
	read := make(chan string, 1)
	go func() { n, _ := pipe.Read(buf); read <- string(buf[:n]) }()
	select {
	case line := <-read:
		if !strings.Contains(line, "CLAIMED") {
			t.Fatal("child failed claim", line)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("child claim timeout")
	}
	if cmd.Process.Kill() != nil {
		t.Fatal("kill actual child")
	}
	if cmd.Wait() == nil {
		t.Fatal("killed process succeeded")
	}
	state(t, db, a.ID, "processing", 1, "leased")
	// Recovery uses the same durable database via a new process/store; no
	// synthetic in-memory lease or success row is substituted for the crash.
	expire(t, db, a.ID)
	w := claim(t, &Store{DB: db}, a.ID)
	if w.Epoch != 2 {
		t.Fatal("crash takeover epoch")
	}
	if s.Finish(context.Background(), w, goodResult()) != nil {
		t.Fatal("crash recovery publication")
	}
	state(t, db, a.ID, "ready", 2, "closed")
}

func TestMySQLLeaseExpiryDuringPublication(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	s := &Store{DB: db}
	a := enqueue(t, s, "expiry_source_01")
	w := claim(t, s, a.ID)
	if _, e := db.Exec("UPDATE document_parse_jobs SET lease_until=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 250000 MICROSECOND) WHERE document_id=?", a.ID); e != nil {
		t.Fatal(e)
	}
	s.Hook = func(stage string) error {
		if stage == "finish-document" {
			time.Sleep(350 * time.Millisecond)
		}
		return nil
	}
	if e := s.Finish(context.Background(), w, goodResult()); !errors.Is(e, ErrLost) {
		t.Fatal("expired while writing result", e)
	}
	state(t, db, a.ID, "processing", 1, "leased")
	if count(t, db, "document_chunks") != 0 || count(t, db, "document_locations") != 0 {
		t.Fatal("final CAS failed to roll back index")
	}
	s.Hook = nil
	next := claim(t, s, a.ID)
	if e := s.Finish(context.Background(), next, goodResult()); e != nil {
		t.Fatal("fresh owner publish", e)
	}
}

func TestMySQLStorageDeadline(t *testing.T) {
	db := testDB(t)
	clean(t, db)
	defer clean(t, db)
	s := &Store{DB: db}
	tx, e := db.Begin()
	if e != nil {
		t.Fatal(e)
	}
	defer tx.Rollback()
	var id int
	if tx.QueryRow("SELECT id FROM users WHERE id=1 FOR UPDATE").Scan(&id) != nil {
		t.Fatal("lock fixture")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 80*time.Millisecond)
	defer cancel()
	at := time.Now()
	if _, e = s.Enqueue(ctx, upload("deadline_source_1")); !errors.Is(e, ErrTimeout) {
		t.Fatal("blocked SQL deadline", e)
	}
	if time.Since(at) > 2*time.Second {
		t.Fatal("database deadline not bounded")
	}
	tx.Rollback()
	if count(t, db, "documents") != 0 || count(t, db, "document_parse_jobs") != 0 || count(t, db, "document_idempotency") != 0 {
		t.Fatal("timed-out request left partial rows")
	}
}
