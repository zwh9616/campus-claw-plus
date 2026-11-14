// Package documentparser implements the reviewed private parser protocol.
// It is an outbound adapter, not an activated public route or database worker.
package documentparser

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/zwh9616/campus-claw-plus/backend/internal/strictjson"
)

const Origin = "http://document-parser:8091"
const maxInput = 10 * 1024 * 1024
const maxOutput = 8 * 1024 * 1024
const maxBody = 2 * 1024 * 1024

var ErrConfig = errors.New("invalid private parser configuration")

type Location struct {
	Kind  string `json:"kind"`
	Unit  int    `json:"unit"`
	Start int    `json:"char_start"`
	End   int    `json:"char_end"`
}

type Result struct {
	Status        string
	Body          string
	Locations     []Location
	SourcePages   *int
	FailureReason string
}

type Client struct {
	token string
	http  *http.Client
}

// New accepts only the origin and canonical token approved in I1/I2.
// Configuration is provided by future composition; no environment is read here.
func New(origin, token string) (*Client, error) {
	key, err := base64.RawURLEncoding.Strict().DecodeString(token)
	if origin != Origin || err != nil || len(key) != 32 || len(token) != 43 || base64.RawURLEncoding.EncodeToString(key) != token {
		return nil, ErrConfig
	}
	transport := &http.Transport{
		Proxy:                  nil,
		DialContext:            (&net.Dialer{Timeout: time.Second}).DialContext,
		ResponseHeaderTimeout:  32 * time.Second,
		MaxResponseHeaderBytes: 8192,
		MaxConnsPerHost:        2,
		IdleConnTimeout:        30 * time.Second,
	}
	return &Client{token: token, http: &http.Client{Transport: transport, Timeout: 35 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

func (c *Client) Close() { c.http.CloseIdleConnections() }

func failed(reason string) Result { return Result{Status: "failed", FailureReason: reason} }

// Healthy is the bounded preflight for NEW uploads only. Replay and old reads
// must be handled by the service without calling this dependency first.
func (c *Client) Healthy(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	code, data, err := c.call(ctx, http.MethodGet, "/health", "", nil)
	if err != nil || code != 200 {
		return false
	}
	var object map[string]json.RawMessage
	if strictjson.Decode(data, &object) != nil || !keys(object, "status") {
		return false
	}
	var status string
	return json.Unmarshal(object["status"], &status) == nil && status == "ok" && ctx.Err() == nil
}

func (c *Client) Parse(ctx context.Context, format string, data []byte) Result {
	contentType := "application/pdf"
	if format == "docx" {
		contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	} else if format != "pdf" {
		return failed("internal_failure")
	}
	if len(data) == 0 {
		return failed("corrupt")
	}
	if len(data) > maxInput {
		return failed("resource_limit")
	}
	ctx, cancel := context.WithTimeout(ctx, 35*time.Second)
	defer cancel()
	code, raw, err := c.call(ctx, http.MethodPost, "/v1/parse", contentType, data)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return failed("parse_timeout")
		}
		if errors.Is(ctx.Err(), context.Canceled) {
			return failed("worker_interrupted")
		}
		var op *net.OpError
		if errors.As(err, &op) || errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return failed("worker_interrupted")
		}
		var network net.Error
		if errors.As(err, &network) && network.Timeout() {
			return failed("parse_timeout")
		}
		return failed("internal_failure")
	}
	result := decodeResult(format, code, raw)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return failed("parse_timeout")
	}
	if ctx.Err() != nil {
		return failed("worker_interrupted")
	}
	return result
}

func (c *Client) call(ctx context.Context, method, path, contentType string, data []byte) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, Origin+path, bytes.NewReader(data))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	response, err := c.http.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer response.Body.Close()
	mediaType, _, err := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" || len(response.Header.Values("Content-Type")) != 1 {
		return 0, nil, strictjson.ErrInvalid
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, maxOutput+1))
	if err != nil {
		return 0, nil, err
	}
	if len(raw) > maxOutput {
		return 0, nil, strictjson.ErrInvalid
	}
	return response.StatusCode, raw, nil
}

func keys(object map[string]json.RawMessage, names ...string) bool {
	if len(object) != len(names) {
		return false
	}
	for _, key := range names {
		if _, ok := object[key]; !ok {
			return false
		}
	}
	return true
}

// Reuse strictjson's duplicate/UTF-8/surrogate checks, with the tighter private
// nesting budget. Never normalize or repair a response before validation.
func decodeResult(format string, code int, raw []byte) Result {
	bad := failed("internal_failure")
	d := json.NewDecoder(bytes.NewReader(raw))
	depth := 0
	for {
		token, err := d.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return bad
		}
		if delimiter, ok := token.(json.Delim); ok {
			if delimiter == '{' || delimiter == '[' {
				depth++
				if depth > 16 {
					return bad
				}
			} else {
				depth--
			}
		}
	}
	var object map[string]json.RawMessage
	if strictjson.Decode(raw, &object) != nil {
		return bad
	}
	if keys(object, "error") {
		var reason string
		if json.Unmarshal(object["error"], &reason) == nil && code == 503 && reason == "busy" {
			return failed("worker_interrupted")
		}
		return bad
	}
	var status string
	if json.Unmarshal(object["status"], &status) != nil {
		return bad
	}
	if status == "failed" {
		if !keys(object, "status", "failure_reason") {
			return bad
		}
		var reason string
		if json.Unmarshal(object["failure_reason"], &reason) != nil {
			return bad
		}
		expected := map[string]int{"corrupt": 422, "encrypted": 422, "unsupported_content": 422, "resource_limit": 422, "parse_timeout": 504, "worker_interrupted": 503, "internal_failure": 503}
		if expected[reason] != code || expected[reason] == 0 {
			return bad
		}
		return failed(reason)
	}
	if code != 200 {
		return bad
	}
	if status == "needs_ocr" {
		var pages int
		if format != "pdf" || !keys(object, "status", "source_page_count") || json.Unmarshal(object["source_page_count"], &pages) != nil || pages < 1 || pages > 200 {
			return bad
		}
		return Result{Status: status, SourcePages: &pages}
	}
	if status != "ready" || !keys(object, "status", "body", "locations", "source_page_count") {
		return bad
	}
	var body string
	if json.Unmarshal(object["body"], &body) != nil || len(body) == 0 || len(body) > maxBody {
		return bad
	}
	for _, r := range body {
		if unicode.IsControl(r) && r != '\t' && r != '\n' {
			return bad
		}
	}
	var pages *int
	if json.Unmarshal(object["source_page_count"], &pages) != nil {
		return bad
	}
	if format == "pdf" {
		if pages == nil || *pages < 1 || *pages > 200 {
			return bad
		}
	} else if format != "docx" || pages != nil {
		return bad
	}
	var items []json.RawMessage
	if json.Unmarshal(object["locations"], &items) != nil || len(items) == 0 || len(items) > 20000 {
		return bad
	}
	runes := []rune(body)
	end, unit := 0, 0
	locations := make([]Location, 0, len(items))
	for _, item := range items {
		var fields map[string]json.RawMessage
		if strictjson.Decode(item, &fields) != nil || !keys(fields, "kind", "unit", "char_start", "char_end") {
			return bad
		}
		var location Location
		if strictjson.Decode(item, &location) != nil || location.Unit <= unit || location.Unit > 20000 || location.Start < end || location.End <= location.Start || location.End > len(runes) {
			return bad
		}
		if format == "pdf" {
			if location.Kind != "pdf_page" || location.Unit > *pages {
				return bad
			}
		} else if location.Kind != "docx_paragraph" && location.Kind != "docx_table_cell" {
			return bad
		}
		separator := "\n\n"
		if unit == 0 {
			separator = ""
		}
		if string(runes[end:location.Start]) != separator || strings.TrimSpace(string(runes[location.Start:location.End])) == "" {
			return bad
		}
		end, unit = location.End, location.Unit
		locations = append(locations, location)
	}
	if end != len(runes) {
		return bad
	}
	return Result{Status: status, Body: body, Locations: locations, SourcePages: pages}
}
