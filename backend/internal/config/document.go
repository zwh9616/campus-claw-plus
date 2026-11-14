package config

import (
	"encoding/base64"
	"errors"
)

type DocumentParser struct{ URL, Token string }

// ReadDocumentParser reads only the two approved backend inputs. No defaults,
// user URLs, normalization or values in errors; a valid configuration does not
// make parser availability a prerequisite for identity/TXT/health startup.
func ReadDocumentParser(lookup func(string) (string, bool)) (DocumentParser, error) {
	u, _ := lookup("DOCUMENT_PARSER_URL")
	token, _ := lookup("DOCUMENT_PARSER_TOKEN")
	bad := func() (DocumentParser, error) {
		return DocumentParser{}, errors.New("document parser configuration invalid")
	}
	if u != "http://document-parser:8091" || len(token) != 43 {
		return bad()
	}
	b, e := base64.RawURLEncoding.DecodeString(token)
	if e != nil || len(b) != 32 || base64.RawURLEncoding.EncodeToString(b) != token {
		return bad()
	}
	return DocumentParser{u, token}, nil
}
