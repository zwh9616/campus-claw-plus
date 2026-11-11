package httpserver

import (
	"bytes"
	"errors"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
)

func TestMRMultipartStrictFieldsAndTotalBoundary(t *testing.T) {
	makeBody := func(fields []string, raw []byte) ([]byte, string) {
		var b bytes.Buffer
		w := multipart.NewWriter(&b)
		for _, name := range fields {
			if name == "file" {
				f, e := w.CreateFormFile(name, "f.txt")
				if e != nil {
					t.Fatal(e)
				}
				f.Write(raw)
			} else {
				w.WriteField(name, "valid")
			}
		}
		w.Close()
		return b.Bytes(), w.FormDataContentType()
	}
	for _, fields := range [][]string{{"title", "file", "title"}, {"file", "file", "title"}, {"file"}, {"title"}, {"title", "file", "class_id"}} {
		b, ct := makeBody(fields, []byte("valid"))
		r := httptest.NewRequest("POST", "/api/v1/materials", bytes.NewReader(b))
		r.Header.Set("Content-Type", ct)
		if _, e := multipartUpload(r); e == nil {
			t.Fatal("MR-SC-04 invalid fields accepted")
		}
	}
	b, ct := makeBody([]string{"title", "file"}, []byte("valid"))
	for _, n := range []int{materials.MaxRequest, materials.MaxRequest + 1} {
		padded := append(append([]byte{}, b...), []byte(strings.Repeat(" ", n-len(b)))...)
		r := httptest.NewRequest("POST", "/api/v1/materials", bytes.NewReader(padded))
		r.Header.Set("Content-Type", ct)
		_, e := multipartUpload(r)
		if n == materials.MaxRequest && e != nil || n > materials.MaxRequest && !errors.Is(e, materials.ErrTooLarge) {
			t.Fatal("whole multipart inclusive size boundary")
		}
	}
}
