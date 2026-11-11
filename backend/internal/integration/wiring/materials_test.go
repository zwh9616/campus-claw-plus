//go:build integration

package wiring

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
)

// MR-SC-01/08/09: actual production proxy/server, trusted TLS, retained MySQL
// volume. The same fixture key proves replay across server and DB recreation.
func verifyMRWiring(t *testing.T, client *http.Client, access string) {
	t.Helper()
	raw := []byte("\ufeff真实资料😀\r\n字面%_keyword\r末尾")
	request := func(method, path, ctype string, body []byte, want int) []byte {
		t.Helper()
		r, _ := http.NewRequest(method, "https://campus.test"+path, bytes.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+access)
		if ctype != "" {
			r.Header.Set("Content-Type", ctype)
		}
		if method == "POST" {
			r.Header.Set("Idempotency-Key", "wiring_material_0001")
			r.Header.Set("Origin", "https://campus.test")
		}
		res, e := client.Do(r)
		if e != nil {
			t.Fatal("MR trusted HTTPS request")
		}
		defer res.Body.Close()
		b, e := io.ReadAll(res.Body)
		if e != nil || res.StatusCode != want {
			t.Fatalf("MR %s status %d want %d", path, res.StatusCode, want)
		}
		if res.Header.Get("Cache-Control") != "no-store" || len(res.Header.Get("X-Request-ID")) != 32 {
			t.Fatal("MR cache/request id")
		}
		return b
	}
	var encoded bytes.Buffer
	writer := multipart.NewWriter(&encoded)
	writer.WriteField("title", "真实课文")
	f, e := writer.CreateFormFile("file", "wiring.txt")
	if e != nil {
		t.Fatal("multipart")
	}
	f.Write(raw)
	writer.Close()
	want := 201
	if os.Getenv("WIRING_EXPECT") == "persist" {
		want = 200
	}
	b := request("POST", "/api/v1/materials", writer.FormDataContentType(), encoded.Bytes(), want)
	var m materials.Material
	if json.Unmarshal(b, &m) != nil || m.IndexStatus != "ready" || m.SizeBytes != len(raw) {
		t.Fatal("MR upload/replay")
	}
	proof := []byte(m.ID)
	path := "/fixtures/material-proof"
	if want == 200 {
		old, e := os.ReadFile(path)
		if e != nil || !bytes.Equal(old, proof) {
			t.Fatal("MR material id changed across recreation")
		}
	} else if os.WriteFile(path, proof, 0644) != nil {
		t.Fatal("MR persistence proof")
	}
	var result materials.SearchResult
	b = request("GET", "/api/v1/search?q=%25_keyword", "", nil, 200)
	if json.Unmarshal(b, &result) != nil || len(result.Items) != 1 || result.Items[0].MaterialID != m.ID {
		t.Fatal("MR literal search persistence")
	}
	var doc materials.Document
	b = request("GET", result.Items[0].URL, "", nil, 200)
	if json.Unmarshal(b, &doc) != nil || doc.Body != strings.ReplaceAll(strings.ReplaceAll(strings.TrimPrefix(string(raw), "\ufeff"), "\r\n", "\n"), "\r", "\n") || !materials.CheckCitation(result.Items[0], doc) {
		t.Fatal("MR quote/codepoint source")
	}
	if !bytes.Equal(request("GET", "/api/v1/materials/"+m.ID+"/download", "", nil, 200), raw) {
		t.Fatal("MR raw bytes lost")
	}
	t.Log("MR-SC-01/08/09 production HTTPS upload, literal search, raw download and persistence passed")
}
