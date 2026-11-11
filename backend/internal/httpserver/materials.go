package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
)

type materialAuthenticator interface {
	Me(context.Context, string) (identity.Principal, error)
}

func materialRoute(path string) (kind, id, methods string) {
	if path == "/api/v1/materials" {
		return "collection", "", "GET, POST"
	}
	if path == "/api/v1/search" {
		return "search", "", "GET"
	}
	if !strings.HasPrefix(path, "/api/v1/materials/") {
		return
	}
	parts := strings.Split(strings.TrimPrefix(path, "/api/v1/materials/"), "/")
	if parts[0] == "" {
		return
	}
	if len(parts) == 1 {
		return "detail", parts[0], "GET"
	}
	if len(parts) == 2 && parts[1] == "download" {
		return "download", parts[0], "GET"
	}
	if len(parts) == 2 && parts[1] == "retry-index" {
		return "retry", parts[0], "POST"
	}
	return
}
func queryValues(r *http.Request, names ...string) (url.Values, error) {
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return nil, identity.ErrInvalid
	}
	for key, values := range values {
		known := false
		for _, name := range names {
			if key == name {
				known = true
			}
		}
		if !known || len(values) != 1 || values[0] == "" {
			return nil, identity.ErrInvalid
		}
	}
	return values, nil
}
func integerQuery(values url.Values, key string, fallback, maximum int) (int, error) {
	if !values.Has(key) {
		return fallback, nil
	}
	raw := values.Get(key)
	for _, r := range raw {
		if r < '0' || r > '9' {
			return 0, identity.ErrInvalid
		}
	}
	n, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || n < 1 || n > int64(maximum) {
		return 0, identity.ErrInvalid
	}
	return int(n), nil
}
func emptyMaterialBody(r *http.Request) error {
	b, err := io.ReadAll(io.LimitReader(r.Body, 1))
	if err != nil || len(b) != 0 {
		return identity.ErrInvalid
	}
	return nil
}
func multipartUpload(r *http.Request) (materials.Upload, error) {
	media, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "multipart/form-data" || params["boundary"] == "" {
		return materials.Upload{}, identity.ErrInvalid
	}
	b, err := io.ReadAll(io.LimitReader(r.Body, materials.MaxRequest+1))
	if len(b) > materials.MaxRequest {
		return materials.Upload{}, materials.ErrTooLarge
	}
	if err != nil {
		return materials.Upload{}, identity.ErrInvalid
	}
	reader := multipart.NewReader(bytes.NewReader(b), params["boundary"])
	var title, filename string
	var raw []byte
	seen := map[string]bool{}
	for {
		part, e := reader.NextRawPart()
		if e == io.EOF {
			break
		}
		if e != nil {
			return materials.Upload{}, identity.ErrInvalid
		}
		if part.Header.Get("Content-Transfer-Encoding") != "" {
			part.Close()
			return materials.Upload{}, identity.ErrInvalid
		}
		name := part.FormName()
		if name != "title" && name != "file" || seen[name] {
			part.Close()
			return materials.Upload{}, identity.ErrInvalid
		}
		seen[name] = true
		content, e := io.ReadAll(part)
		part.Close()
		if e != nil {
			return materials.Upload{}, identity.ErrInvalid
		}
		if name == "title" {
			if part.FileName() != "" {
				return materials.Upload{}, identity.ErrInvalid
			}
			title = string(content)
		} else {
			filename, raw = part.FileName(), content
		}
	}
	if !seen["title"] || !seen["file"] {
		return materials.Upload{}, identity.ErrInvalid
	}
	return materials.PrepareUpload(title, filename, raw)
}

// MaterialsHandler adds only the six approved MR operations. Other paths retain
// the identity handler and its logging; matched paths are observed exactly once.
func MaterialsHandler(logger *slog.Logger, auth materialAuthenticator, service *materials.Service, origin string, limiter *materials.Limiter, fallback http.Handler) http.Handler {
	business := Observe(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		kind, id, methods := materialRoute(r.URL.Path)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if !strings.Contains(","+strings.ReplaceAll(methods, " ", "")+",", ","+r.Method+",") {
			w.Header().Set("Allow", methods)
			w.WriteHeader(405)
			return
		}
		fail := func(err error) {
			if errors.Is(err, materials.ErrTooLarge) {
				writeIdentityCode(w, 413, "PAYLOAD_TOO_LARGE", "请求过大")
			} else {
				writeIdentityError(w, err)
			}
		}
		if kind == "collection" && r.Method == "POST" && r.ContentLength > materials.MaxRequest {
			fail(materials.ErrTooLarge)
			return
		}
		access := ""
		values := r.Header.Values("Authorization")
		if len(values) == 1 && strings.HasPrefix(values[0], "Bearer ") {
			access = strings.TrimPrefix(values[0], "Bearer ")
		}
		p, err := auth.Me(r.Context(), access)
		if err != nil {
			fail(err)
			return
		}
		if err = materials.Readable(p); err != nil {
			fail(err)
			return
		}
		if r.Method == "POST" {
			if err = materials.Writable(p); err != nil {
				fail(err)
				return
			}
			origins := r.Header.Values("Origin")
			if len(origins) > 1 || len(origins) == 1 && origins[0] != origin {
				fail(identity.ErrForbidden)
				return
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		var doc materials.Document
		if id != "" {
			if !materials.ValidID(id) {
				fail(identity.ErrInvalid)
				return
			}
			doc, err = service.Repo.GetMaterial(ctx, p, id)
			if err != nil {
				fail(err)
				return
			}
		}
		if r.Method == "POST" {
			if allowed, retry := limiter.Allow(p.UserID); !allowed {
				w.Header().Set("Retry-After", strconv.Itoa(retry))
				writeIdentityCode(w, 429, "RATE_LIMITED", "请稍后重试")
				return
			}
		}
		if r.Method == "GET" || kind == "retry" {
			if err = emptyMaterialBody(r); err != nil {
				fail(err)
				return
			}
		}
		switch kind {
		case "collection":
			if r.Method == "GET" {
				query, e := queryValues(r, "page", "page_size")
				if e != nil {
					fail(e)
					return
				}
				page, e := integerQuery(query, "page", 1, 2147483647)
				if e != nil {
					fail(e)
					return
				}
				size, e := integerQuery(query, "page_size", 20, 50)
				if e != nil {
					fail(e)
					return
				}
				out, e := service.Repo.ListMaterials(ctx, p, page, size)
				if e != nil {
					fail(e)
					return
				}
				json.NewEncoder(w).Encode(out)
				return
			}
			if _, err = queryValues(r); err != nil {
				fail(err)
				return
			}
			keys := r.Header.Values("Idempotency-Key")
			if len(keys) != 1 || !materials.ValidKey(keys[0]) {
				fail(identity.ErrInvalid)
				return
			}
			upload, e := multipartUpload(r)
			if e != nil {
				fail(e)
				return
			}
			out, created, e := service.Create(ctx, p, keys[0], upload)
			if e != nil {
				fail(e)
				return
			}
			if created {
				w.WriteHeader(201)
			}
			json.NewEncoder(w).Encode(out)
		case "detail", "download", "retry":
			if _, err = queryValues(r); err != nil {
				fail(err)
				return
			}
			if kind == "download" {
				w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				w.Header().Set("Content-Disposition", `attachment; filename="material-`+id+`.txt"`)
				w.Header().Set("X-Content-Type-Options", "nosniff")
				w.Write(doc.Raw)
				return
			}
			if kind == "retry" {
				out, e := service.Repo.IndexMaterial(ctx, p, id)
				if e != nil {
					fail(e)
					return
				}
				json.NewEncoder(w).Encode(out)
				return
			}
			json.NewEncoder(w).Encode(doc)
		case "search":
			query, e := queryValues(r, "q", "mode", "top_k")
			if e != nil {
				fail(e)
				return
			}
			q := strings.TrimSpace(query.Get("q"))
			if !materials.Text(q, 1, 2000) || query.Has("mode") && query.Get("mode") != "keyword" {
				fail(identity.ErrInvalid)
				return
			}
			top, e := integerQuery(query, "top_k", 4, 10)
			if e != nil {
				fail(e)
				return
			}
			out, e := service.Repo.SearchMaterials(ctx, p, q, top)
			if e != nil {
				fail(e)
				return
			}
			json.NewEncoder(w).Encode(out)
		}
	}))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if kind, _, _ := materialRoute(r.URL.Path); kind == "" {
			fallback.ServeHTTP(w, r)
		} else {
			business.ServeHTTP(w, r)
		}
	})
}
