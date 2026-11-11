//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/config"
	"github.com/zwh9616/campus-claw-plus/backend/internal/httpserver"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
)

func mrMultipart(t *testing.T, title, name string, raw []byte) ([]byte, string) {
	t.Helper()
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	if w.WriteField("title", title) != nil {
		t.Fatal("title")
	}
	f, e := w.CreateFormFile("file", name)
	if e != nil {
		t.Fatal("file")
	}
	f.Write(raw)
	w.Close()
	return b.Bytes(), w.FormDataContentType()
}
func TestMRRealUploadSearchAuthorizationAndRecovery(t *testing.T) {
	ctx := context.Background()
	app, db, name := database(t, 11)
	ex := migrations.Executor{DB: db, Database: name}
	if ex.Up(ctx, 4) != nil {
		t.Fatal("MR-SC-08 empty upgrade")
	}
	if (&mysqlstore.Store{DB: db}).Initialize(ctx, seed(t), nil) != nil {
		t.Fatal("initialize")
	}
	repo := &mysqlstore.Store{DB: app}
	auth, e := identity.New(repo, nil, "https://campus.test")
	if e != nil {
		t.Fatal(e)
	}
	login := func(user string) identity.Issued {
		t.Helper()
		v, e := auth.Login(ctx, user, "test-only-"+user, strings.Repeat("a", 32))
		if e != nil {
			t.Fatal("login")
		}
		return v
	}
	teacher, student, student2, other := login("teacher-a"), login("student-a"), login("student-a2"), login("student-b")
	service := &materials.Service{Repo: repo}
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	base := httpserver.IdentityHandler(logger, auth, repo, config.Identity{}, identity.NewLimiter(nil))
	srv := httptest.NewTLSServer(httpserver.MaterialsHandler(logger, auth, service, "https://campus.test", materials.NewLimiter(nil), base))
	defer srv.Close()
	call := func(method, path, access, ctype, key, origin string, body []byte, want int) ([]byte, http.Header) {
		t.Helper()
		r, _ := http.NewRequest(method, srv.URL+path, bytes.NewReader(body))
		if access != "" {
			r.Header.Set("Authorization", "Bearer "+access)
		}
		if ctype != "" {
			r.Header.Set("Content-Type", ctype)
		}
		if key != "" {
			r.Header.Set("Idempotency-Key", key)
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		r.Header.Set("X-Class-ID", teacher.Body.Principal.ClassID)
		r.Header.Set("X-Role", "teacher")
		res, e := srv.Client().Do(r)
		if e != nil {
			t.Fatal("trusted HTTPS")
		}
		defer res.Body.Close()
		b, e := io.ReadAll(res.Body)
		if e != nil || res.StatusCode != want {
			t.Fatalf("%s %s got %d want %d", method, path, res.StatusCode, want)
		}
		if res.Header.Get("Cache-Control") != "no-store" || len(res.Header.Get("X-Request-ID")) != 32 {
			t.Fatal("cache/request id")
		}
		return b, res.Header
	}
	raw := []byte("\ufeff中文😀\r\n100%_Case\r" + strings.Repeat("资料😀", 1500))
	body, ctype := mrMultipart(t, "  课文😀  ", "lesson.TXT", raw)
	key := "normal_upload_0001"
	b, _ := call("POST", "/api/v1/materials", teacher.Body.AccessToken, ctype, key, "https://campus.test", body, 201)
	var m materials.Material
	if json.Unmarshal(b, &m) != nil || m.IndexStatus != "ready" || m.SizeBytes != len(raw) {
		t.Fatal("MR-SC-01 upload")
	}
	path := "/api/v1/materials/" + m.ID
	for _, s := range []identity.Issued{student, student2} {
		listed, _ := call("GET", "/api/v1/materials?page=1&page_size=1", s.Body.AccessToken, "", "", "", nil, 200)
		var page materials.Page
		if json.Unmarshal(listed, &page) != nil || page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != m.ID {
			t.Fatal("MR-SC-01 authorized list")
		}
		b, _ = call("GET", path, s.Body.AccessToken, "", "", "", nil, 200)
		var doc materials.Document
		if json.Unmarshal(b, &doc) != nil || doc.Body != "中文😀\n100%_Case\n"+strings.Repeat("资料😀", 1500) {
			t.Fatal("normalized body")
		}
		download, h := call("GET", path+"/download", s.Body.AccessToken, "", "", "", nil, 200)
		if !bytes.Equal(download, raw) || h.Get("Content-Disposition") != `attachment; filename="material-`+m.ID+`.txt"` {
			t.Fatal("download must preserve raw bytes")
		}
		for _, q := range []string{"中文😀", "%_Case", "资料😀"} {
			b, _ = call("GET", "/api/v1/search?q="+url.QueryEscape(" "+q+" "), s.Body.AccessToken, "", "", "", nil, 200)
			var result materials.SearchResult
			if json.Unmarshal(b, &result) != nil || len(result.Items) == 0 || len(result.Items) > 4 {
				t.Fatal("MR-SC-09 search")
			}
			for _, c := range result.Items {
				if !materials.CheckCitation(c, doc) {
					t.Fatal("citation mismatch")
				}
			}
		}
	}
	before := count(t, db, "materials")
	for _, principal := range []identity.Issued{other, login("teacher-b")} {
		listed, _ := call("GET", "/api/v1/materials", principal.Body.AccessToken, "", "", "", nil, 200)
		var page materials.Page
		if json.Unmarshal(listed, &page) != nil || page.Total != 0 || len(page.Items) != 0 {
			t.Fatal("foreign list leaked")
		}
		searched, _ := call("GET", "/api/v1/search?q="+url.QueryEscape("中文😀"), principal.Body.AccessToken, "", "", "", nil, 200)
		var result materials.SearchResult
		if json.Unmarshal(searched, &result) != nil || len(result.Items) != 0 {
			t.Fatal("foreign search leaked")
		}
		call("GET", path+"/download", principal.Body.AccessToken, "", "", "", nil, 404)
		if principal.Body.Principal.Role == "teacher" {
			call("POST", path+"/retry-index", principal.Body.AccessToken, "", "", "", nil, 404)
		}
	}
	for _, access := range []string{"", "expired-invalid"} {
		call("GET", path, access, "", "", "", nil, 401)
	}
	notFound, _ := call("GET", path, other.Body.AccessToken, "", "", "", nil, 404)
	missing, _ := call("GET", "/api/v1/materials/9223372036854775807", other.Body.AccessToken, "", "", "", nil, 404)
	var a, z map[string]any
	json.Unmarshal(notFound, &a)
	json.Unmarshal(missing, &z)
	if fmt.Sprint(a["error"]) != fmt.Sprint(z["error"]) {
		t.Fatal("cross-class existence leak")
	}
	call("POST", "/api/v1/materials", student.Body.AccessToken, ctype, key, "", body, 403)
	call("POST", path+"/retry-index", student.Body.AccessToken, "", "", "", nil, 403)
	call("POST", path+"/retry-index", other.Body.AccessToken, "", "", "", nil, 403)
	call("POST", "/api/v1/materials", teacher.Body.AccessToken, ctype, key, "https://other.invalid", body, 403)
	for _, query := range []string{"page=0", "page_size=51", "page=1&page=2", "class_id=1", "page=", "page=+1"} {
		call("GET", "/api/v1/materials?"+query, teacher.Body.AccessToken, "", "", "", nil, 400)
	}
	for _, query := range []string{"q=x&mode=vector", "q=x&mode=hybrid", "q=x&top_k=11", "q=x&q=y", "q=", "q=x&class_id=1", "q=%00"} {
		call("GET", "/api/v1/search?"+query, teacher.Body.AccessToken, "", "", "", nil, 400)
	}
	call("GET", path+"?unknown=1", student.Body.AccessToken, "", "", "", nil, 400)
	call("GET", path, student.Body.AccessToken, "", "", "", []byte("x"), 400)
	if count(t, db, "materials") != before {
		t.Fatal("rejected request side effects")
	}
	b, _ = call("POST", "/api/v1/materials", teacher.Body.AccessToken, ctype, key, "", body, 200)
	var replay materials.Material
	json.Unmarshal(b, &replay)
	if replay.ID != m.ID {
		t.Fatal("lost-response replay")
	}
	changed, changedType := mrMultipart(t, "different", "lesson.txt", raw)
	call("POST", "/api/v1/materials", teacher.Body.AccessToken, changedType, key, "", changed, 409)
	for _, invalid := range [][]byte{[]byte("\ufeff \r\n"), {0xff}, {0}, []byte("text\u0085")} {
		bad, ct := mrMultipart(t, "title", "f.txt", invalid)
		call("POST", "/api/v1/materials", teacher.Body.AccessToken, ct, "invalid_body_0001", "", bad, 400)
	}
	tooBig, ct := mrMultipart(t, "title", "f.txt", []byte(strings.Repeat("x", materials.MaxFile+1)))
	call("POST", "/api/v1/materials", teacher.Body.AccessToken, ct, "oversized_file_01", "", tooBig, 413)
	call("POST", "/api/v1/materials", teacher.Body.AccessToken, ctype, "oversized_stream", "", append(body, bytes.Repeat([]byte("x"), materials.MaxRequest)...), 413)
	// Same user/class/key is enforced by the DB under genuine contention.
	u, _ := materials.PrepareUpload("concurrent", "f.txt", []byte("concurrent中文😀"))
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	ids := make(chan string, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			item, _, e := service.Create(ctx, teacher.Body.Principal, "concurrent_key_01", u)
			errs <- e
			ids <- item.ID
		}()
	}
	wg.Wait()
	close(errs)
	close(ids)
	for e := range errs {
		if e != nil {
			t.Fatal("concurrent replay", e)
		}
	}
	unique := ""
	for id := range ids {
		if unique != "" && id != unique {
			t.Fatal("duplicate material")
		}
		unique = id
	}
	if count(t, db, "materials") != before+1 || count(t, db, "material_idempotency") != before+1 {
		t.Fatal("duplicate persistence")
	}
	for _, step := range []int{1, 2} {
		repo.MaterialHook = func(stage string, n int) error {
			if stage == "create" && n == step {
				return errors.New("injected")
			}
			return nil
		}
		if _, _, e = service.Create(ctx, teacher.Body.Principal, fmt.Sprintf("rollback_key_%04d", step), u); e == nil {
			t.Fatal("create injection accepted")
		}
		if count(t, db, "materials") != before+1 {
			t.Fatal("partial create committed")
		}
	}
	// Force a partial chunk write, then retry concurrently on a new Store instance.
	repo.MaterialHook = func(stage string, n int) error {
		if stage == "index" && n == 1 {
			return errors.New("injected")
		}
		return nil
	}
	long, _ := materials.PrepareUpload("failed", "f.txt", []byte(strings.Repeat("索引😀", 2000)))
	failed, _, e := service.Create(ctx, teacher.Body.Principal, "index_failure_01", long)
	if e != nil || failed.IndexStatus != "failed" {
		t.Fatal("MR-SC-07 failed status")
	}
	var chunks int
	if db.QueryRow("SELECT COUNT(*) FROM material_chunks WHERE material_id=?", failed.ID).Scan(&chunks) != nil || chunks != 0 {
		t.Fatal("half-index survived")
	}
	call("GET", "/api/v1/materials/"+failed.ID, student.Body.AccessToken, "", "", "", nil, 404)
	repo.MaterialHook = nil
	fresh := &mysqlstore.Store{DB: app}
	errs = make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			item, e := fresh.IndexMaterial(ctx, teacher.Body.Principal, failed.ID)
			if e == nil && item.IndexStatus != "ready" {
				e = errors.New("not ready")
			}
			errs <- e
		}()
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal("concurrent index retry", e)
		}
	}
	if db.QueryRow("SELECT COUNT(*) FROM material_chunks WHERE material_id=?", failed.ID).Scan(&chunks) != nil || chunks != len(materials.Chunks(long.Body)) {
		t.Fatal("duplicate/partial chunk set")
	}
	if _, e = db.Exec("UPDATE material_chunks SET quote='损坏' WHERE material_id=? AND ordinal=0", failed.ID); e != nil {
		t.Fatal("corrupt fixture")
	}
	call("GET", "/api/v1/search?q="+url.QueryEscape("损坏"), student.Body.AccessToken, "", "", "", nil, 503)
	// Stable pagination and teacher-only visibility use identical filters/counts.
	for _, principal := range []identity.Issued{teacher, student} {
		seen := map[string]bool{}
		for page := 1; page <= 3; page++ {
			b, _ := call("GET", fmt.Sprintf("/api/v1/materials?page=%d&page_size=1", page), principal.Body.AccessToken, "", "", "", nil, 200)
			var out materials.Page
			if json.Unmarshal(b, &out) != nil || out.Total != 3 || len(out.Items) != 1 || seen[out.Items[0].ID] {
				t.Fatal("MR-SC-03 pagination")
			}
			seen[out.Items[0].ID] = true
		}
	}
	maximum, maximumType := mrMultipart(t, "maximum", "max.txt", bytes.Repeat([]byte("x"), materials.MaxFile))
	maxResult, _ := call("POST", "/api/v1/materials", teacher.Body.AccessToken, maximumType, "maximum_file_0001", "", maximum, 201)
	var maxMaterial materials.Material
	if json.Unmarshal(maxResult, &maxMaterial) != nil || maxMaterial.SizeBytes != materials.MaxFile || maxMaterial.IndexStatus != "ready" {
		t.Fatal("inclusive maximum must persist")
	}
	child := exec.Command(os.Args[0], "-test.run=^TestMRPendingCommitExit$")
	child.Env = append(os.Environ(), "MR_PENDING_CHILD=1")
	child.Stdout, child.Stderr = io.Discard, io.Discard
	if child.Run() != nil {
		t.Fatal("post-commit process exit fixture")
	}
	var pending materials.Material
	if db.QueryRow("SELECT id,index_status FROM materials WHERE title='process-exit'").Scan(&pending.ID, &pending.IndexStatus) != nil || pending.IndexStatus != "pending" {
		t.Fatal("committed pending must survive process exit")
	}
	call("GET", "/api/v1/materials/"+pending.ID, student.Body.AccessToken, "", "", "", nil, 404)
	call("POST", "/api/v1/materials/"+pending.ID+"/retry-index", teacher.Body.AccessToken, "", "", "", nil, 200)
	call("GET", "/api/v1/materials/"+pending.ID, student.Body.AccessToken, "", "", "", nil, 200)
	// User quota is shared across writes and class switches; authorization failures did not consume it.
	quotaSrv := httptest.NewTLSServer(httpserver.MaterialsHandler(logger, auth, service, "https://campus.test", materials.NewLimiter(func() time.Time { return time.Unix(120, 0) }), base))
	defer quotaSrv.Close()
	old := srv
	srv = quotaSrv
	for i := 0; i < 13; i++ {
		want := 200
		if i == 12 {
			want = 429
		}
		_, h := call("POST", path+"/retry-index", teacher.Body.AccessToken, "", "", "", nil, want)
		if want == 429 && h.Get("Retry-After") == "" {
			t.Fatal("quota retry")
		}
	}
	srv = old
	// Real 01 session transition invalidates prior material access.
	if _, e = auth.Mutate(ctx, identity.Mutation{Action: "switch-class", Access: teacher.Body.AccessToken, Refresh: teacher.Refresh, CSRF: "invalid-csrf", Origin: "https://campus.test", RequestID: strings.Repeat("b", 32), ClassID: func() (string, error) { return other.Body.Principal.ClassID, nil }}); e == nil {
		t.Fatal("CSRF boundary")
	}
	if _, e = auth.Mutate(ctx, identity.Mutation{Action: "logout", Access: student.Body.AccessToken, Refresh: student.Refresh, CSRF: "invalid-csrf", Origin: "https://campus.test", RequestID: strings.Repeat("c", 32)}); e == nil {
		t.Fatal("logout CSRF boundary")
	}
	csrf, e := auth.GetCSRF(ctx, teacher.Refresh)
	if e != nil {
		t.Fatal("csrf")
	}
	switched, e := auth.Mutate(ctx, identity.Mutation{Action: "switch-class", Access: teacher.Body.AccessToken, Refresh: teacher.Refresh, CSRF: csrf, Origin: "https://campus.test", RequestID: strings.Repeat("d", 32), ClassID: func() (string, error) { return other.Body.Principal.ClassID, nil }})
	if e != nil {
		t.Fatal("switch")
	}
	call("GET", path, teacher.Body.AccessToken, "", "", "", nil, 401)
	srv = quotaSrv
	call("POST", "/api/v1/materials", switched.Body.AccessToken, ctype, key, "", body, 429)
	srv = old
	createdB, isNew, e := service.Create(ctx, switched.Body.Principal, key, u)
	if e != nil || !isNew || createdB.ID == m.ID {
		t.Fatal("same idempotency key must be class scoped")
	}
	call("GET", path, switched.Body.AccessToken, "", "", "", nil, 404)
	csrf, e = auth.GetCSRF(ctx, student.Refresh)
	if e != nil {
		t.Fatal("student csrf")
	}
	if _, e = auth.Mutate(ctx, identity.Mutation{Action: "logout", Access: student.Body.AccessToken, Refresh: student.Refresh, CSRF: csrf, Origin: "https://campus.test", RequestID: strings.Repeat("f", 32)}); e != nil {
		t.Fatal("logout")
	}
	call("GET", path, student.Body.AccessToken, "", "", "", nil, 401)
	if _, e = db.Exec("UPDATE users SET enabled=0 WHERE id=?", student2.Body.Principal.UserID); e != nil {
		t.Fatal("revoke fixture")
	}
	call("GET", path, student2.Body.AccessToken, "", "", "", nil, 401)
	timed, cancel := context.WithTimeout(ctx, time.Nanosecond)
	time.Sleep(time.Millisecond)
	defer cancel()
	if _, e = fresh.SearchMaterials(timed, switched.Body.Principal, "x", 4); !errors.Is(e, identity.ErrTimeout) {
		t.Fatal("query budget must yield504")
	}
	app.Close()
	call("GET", "/api/v1/search?q=x", switched.Body.AccessToken, "", "", "", nil, 503)
}

func TestMRPendingCommitExit(t *testing.T) {
	if os.Getenv("MR_PENDING_CHILD") != "1" {
		return
	}
	app, _, _ := database(t, 11)
	repo := &mysqlstore.Store{DB: app}
	auth, e := identity.New(repo, nil, "https://campus.test")
	if e != nil {
		os.Exit(1)
	}
	issued, e := auth.Login(context.Background(), "teacher-a", "test-only-teacher-a", strings.Repeat("a", 32))
	if e != nil {
		os.Exit(1)
	}
	u, e := materials.PrepareUpload("process-exit", "f.txt", []byte("persisted before process exit"))
	if e != nil {
		os.Exit(1)
	}
	_, _, e = repo.CreateMaterial(context.Background(), issued.Body.Principal, "pending_process_01", u)
	if e != nil {
		os.Exit(1)
	}
	// Deliberately exit without indexing or cleanup in this child process.
	os.Exit(0)
}

func TestMRMigrationEveryDDLAndDrift(t *testing.T) {
	ctx := context.Background()
	for step := 1; step <= 3; step++ {
		t.Run(fmt.Sprint(step), func(t *testing.T) {
			_, db, name := database(t, 11+step)
			ex := migrations.Executor{DB: db, Database: name}
			if ex.Up(ctx, 3) != nil {
				t.Fatal("baseline")
			}
			if (&mysqlstore.Store{DB: db}).Initialize(ctx, seed(t), nil) != nil {
				t.Fatal("baseline identity")
			}
			ex.AfterDDL = func(v, n int) error {
				if v == 4 && n == step {
					return errors.New("interrupted")
				}
				return nil
			}
			if ex.Up(ctx, 4) == nil || ex.Check(ctx, 4) == nil {
				t.Fatal("MR-SC-08 dirty accepted")
			}
			ex.AfterDDL = nil
			if ex.Repair(ctx, 4) != nil || ex.Check(ctx, 4) != nil || count(t, db, "users") != 5 {
				t.Fatal("forward repair lost identity")
			}
			var checksum string
			if db.QueryRow("SELECT up_sha256 FROM identity_migration_checksums WHERE version=4").Scan(&checksum) != nil {
				t.Fatal("v4 checksum")
			}
			if _, e := db.Exec("UPDATE identity_migration_checksums SET up_sha256=? WHERE version=4", strings.Repeat("0", 64)); e != nil {
				t.Fatal("checksum fixture")
			}
			if ex.Check(ctx, 4) == nil || ex.Repair(ctx, 4) == nil {
				t.Fatal("wrong v4 checksum accepted")
			}
			if _, e := db.Exec("UPDATE identity_migration_checksums SET up_sha256=? WHERE version=4", checksum); e != nil {
				t.Fatal("checksum restore")
			}
			if _, e := db.Exec("DELETE FROM identity_migration_checksums WHERE version=4"); e != nil {
				t.Fatal("missing checksum fixture")
			}
			if ex.Check(ctx, 4) == nil || ex.Repair(ctx, 4) != nil {
				t.Fatal("missing checksum must block then explicitly recover")
			}
			if ex.Check(ctx, 3) == nil {
				t.Fatal("old exact target accepted database4")
			}
			if _, e := db.Exec("ALTER TABLE material_chunks MODIFY quote MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL"); e != nil {
				t.Fatal("drift fixture")
			}
			if ex.Check(ctx, 4) == nil || ex.Repair(ctx, 4) == nil {
				t.Fatal("incompatible structure accepted")
			}
		})
	}
}

func TestMREmptyDownOnly(t *testing.T) {
	ctx := context.Background()
	_, db, name := database(t, 17)
	ex := migrations.Executor{DB: db, Database: name}
	if ex.Up(ctx, 4) != nil {
		t.Fatal("empty down setup")
	}
	for _, table := range []string{"users", "classes", "class_memberships", "sessions", "access_credentials", "auth_audit", "materials", "material_idempotency", "material_chunks"} {
		if count(t, db, table) != 0 {
			t.Fatal("down requires dedicated entirely empty fixture")
		}
	}
	data, e := os.ReadFile("../migrations/sql/000004_materials_retrieval.down.sql")
	if e != nil {
		t.Fatal("empty down source")
	}
	if _, e = db.Exec(string(data)); e != nil {
		t.Fatal("child-first empty down")
	}
	if ex.Check(ctx, 4) == nil {
		t.Fatal("removed structure accepted")
	}
}
