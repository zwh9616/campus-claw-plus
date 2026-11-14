package config

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestDocumentParserRequiredCanonicalConfiguration(t *testing.T) {
	valid := map[string]string{"DOCUMENT_PARSER_URL": "http://document-parser:8091", "DOCUMENT_PARSER_TOKEN": base64.RawURLEncoding.EncodeToString(make([]byte, 32))}
	lookup := func(values map[string]string) func(string) (string, bool) {
		return func(k string) (string, bool) {
			if k != "DOCUMENT_PARSER_URL" && k != "DOCUMENT_PARSER_TOKEN" {
				t.Fatal("unexpected input", k)
			}
			v, ok := values[k]
			return v, ok
		}
	}
	if _, e := ReadDocumentParser(lookup(valid)); e != nil {
		t.Fatal(e)
	}
	for _, key := range []string{"DOCUMENT_PARSER_URL", "DOCUMENT_PARSER_TOKEN"} {
		for _, value := range []string{"", " ", "\t", valid[key] + " ", " " + valid[key], "sentinel-private-value"} {
			v := map[string]string{}
			for k, x := range valid {
				v[k] = x
			}
			v[key] = value
			if _, e := ReadDocumentParser(lookup(v)); e == nil || strings.Contains(e.Error(), value) && len(value) > 1 {
				t.Fatal("invalid input accepted/echoed", key)
			}
		}
	}
	for _, token := range []string{strings.Repeat("a", 42), strings.Repeat("a", 44), strings.Repeat("a", 42) + "B", valid["DOCUMENT_PARSER_TOKEN"] + "=", strings.Repeat("é", 43)} {
		v := map[string]string{"DOCUMENT_PARSER_URL": valid["DOCUMENT_PARSER_URL"], "DOCUMENT_PARSER_TOKEN": token}
		if _, e := ReadDocumentParser(lookup(v)); e == nil {
			t.Fatal("noncanonical token")
		}
	}
	for _, url := range []string{"http://document-parser:8091/", "http://document-parser:8091?x=1", "http://document-parser:8091#x", "http://user@document-parser:8091", "http://127.0.0.1:8091", "https://document-parser:8091", "http://document-parser.evil:8091"} {
		v := map[string]string{"DOCUMENT_PARSER_URL": url, "DOCUMENT_PARSER_TOKEN": valid["DOCUMENT_PARSER_TOKEN"]}
		if _, e := ReadDocumentParser(lookup(v)); e == nil {
			t.Fatal("unapproved origin")
		}
	}
}
