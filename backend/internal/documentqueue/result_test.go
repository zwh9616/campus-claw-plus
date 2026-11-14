package documentqueue

import (
	"strings"
	"testing"
)

func TestResultBoundaries(t *testing.T) {
	p := 2
	good := Result{Status: "ready", Body: "课程😀\n\n第二页", Pages: &p, Locations: []Location{{"pdf_page", 1, 0, 3}, {"pdf_page", 2, 5, 8}}}
	if !validResult("pdf", good) {
		t.Fatal("Unicode source")
	}
	for _, change := range []func(*Result){
		func(r *Result) { r.Locations[0].End = 4 }, func(r *Result) { r.Locations[1].Start = 4 },
		func(r *Result) { r.Locations[1].Unit = 1 }, func(r *Result) { r.Locations[1].Kind = "docx_paragraph" },
		func(r *Result) { r.Body += "x" }, func(r *Result) { r.Body = "课程😀\r\n第二页" },
		func(r *Result) { r.Failure = "corrupt" }, func(r *Result) { r.Pages = nil },
		func(r *Result) { r.Body = string([]byte{0xff}) }, func(r *Result) { r.Body = strings.Repeat("x", 2097153) },
	} {
		r := good
		r.Locations = append([]Location(nil), good.Locations...)
		change(&r)
		if validResult("pdf", r) {
			t.Fatal("invalid source accepted")
		}
	}
	if validResult("docx", good) {
		t.Fatal("Word page fabricated")
	}
	good.Pages = nil
	good.Locations = []Location{{"docx_paragraph", 1, 0, 3}, {"docx_table_cell", 3, 5, 8}}
	if !validResult("docx", good) {
		t.Fatal("Word skipped empty unit")
	}
	if !validResult("pdf", Result{Status: "needs_ocr", Pages: &p}) || validResult("docx", Result{Status: "needs_ocr", Pages: &p}) {
		t.Fatal("OCR state")
	}
	for _, reason := range []string{"corrupt", "encrypted", "unsupported_content", "resource_limit", "parse_timeout", "worker_interrupted", "internal_failure"} {
		if !validResult("pdf", Result{Status: "failed", Failure: reason}) {
			t.Fatal(reason)
		}
	}
	for _, reason := range []string{"", "other", "corrupt|encrypted"} {
		if validResult("pdf", Result{Status: "failed", Failure: reason}) {
			t.Fatal("open failure enum")
		}
	}
}
