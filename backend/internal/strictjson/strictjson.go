// Package strictjson rejects ambiguity before decoding credentials or seed input.
package strictjson

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"reflect"
	"strings"
	"unicode/utf8"
)

var ErrInvalid = errors.New("invalid JSON")
var ErrTooLarge = errors.New("JSON exceeds 64 KiB")

func Read(r io.Reader) ([]byte, error) {
	b, e := io.ReadAll(io.LimitReader(r, 65537))
	if e != nil {
		return nil, ErrInvalid
	}
	if len(b) > 65536 {
		return nil, ErrTooLarge
	}
	return b, nil
}
func Decode(b []byte, dst any) error {
	if !utf8.Valid(b) || !validUnicodeEscapes(b) {
		return ErrInvalid
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.UseNumber()
	if e := value(d, 0); e != nil {
		return ErrInvalid
	}
	if _, e := d.Token(); e != io.EOF {
		return ErrInvalid
	}
	if !exactFields(b, reflect.TypeOf(dst)) {
		return ErrInvalid
	}
	d = json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if e := d.Decode(dst); e != nil {
		return ErrInvalid
	}
	return nil
}

// encoding/json otherwise accepts case-insensitive field names. Contracts are
// case-sensitive and non-null: "Username" must not alias "username".
func exactFields(raw []byte, t reflect.Type) bool {
	if t == nil {
		return false
	}
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return false
	}
	if t == reflect.TypeOf(json.RawMessage{}) {
		return true
	}
	switch t.Kind() {
	case reflect.Struct:
		var object map[string]json.RawMessage
		if json.Unmarshal(raw, &object) != nil {
			return false
		}
		allowed := map[string]reflect.Type{}
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			if f.PkgPath != "" {
				continue
			}
			name := strings.Split(f.Tag.Get("json"), ",")[0]
			if name == "" {
				name = f.Name
			}
			if name != "-" {
				allowed[name] = f.Type
			}
		}
		for k, v := range object {
			ft, ok := allowed[k]
			if !ok || !exactFields(v, ft) {
				return false
			}
		}
	case reflect.Slice, reflect.Array:
		var items []json.RawMessage
		if json.Unmarshal(raw, &items) != nil {
			return false
		}
		for _, item := range items {
			if !exactFields(item, t.Elem()) {
				return false
			}
		}
	}
	return true
}
func value(d *json.Decoder, depth int) error {
	if depth > 32 {
		return ErrInvalid
	}
	t, e := d.Token()
	if e != nil {
		return e
	}
	delim, ok := t.(json.Delim)
	if !ok {
		return nil
	}
	switch delim {
	case '{':
		seen := map[string]bool{}
		for d.More() {
			key, e := d.Token()
			if e != nil {
				return e
			}
			s, ok := key.(string)
			if !ok || seen[s] {
				return ErrInvalid
			}
			seen[s] = true
			if e = value(d, depth+1); e != nil {
				return e
			}
		}
		end, e := d.Token()
		if e != nil || end != json.Delim('}') {
			return ErrInvalid
		}
	case '[':
		for d.More() {
			if e = value(d, depth+1); e != nil {
				return e
			}
		}
		end, e := d.Token()
		if e != nil || end != json.Delim(']') {
			return ErrInvalid
		}
	default:
		return ErrInvalid
	}
	return nil
}

// encoding/json replaces isolated UTF-16 escapes. Contract strings must retain
// their exact Unicode scalar values, so reject these before decoding.
func validUnicodeEscapes(b []byte) bool {
	inside := false
	hex := func(c byte) int {
		switch {
		case c >= '0' && c <= '9':
			return int(c - '0')
		case c >= 'a' && c <= 'f':
			return int(c-'a') + 10
		case c >= 'A' && c <= 'F':
			return int(c-'A') + 10
		}
		return -1
	}
	unit := func(at int) int {
		if at+4 > len(b) {
			return -1
		}
		n := 0
		for _, c := range b[at : at+4] {
			v := hex(c)
			if v < 0 {
				return -1
			}
			n = n*16 + v
		}
		return n
	}
	for i := 0; i < len(b); i++ {
		if b[i] == '"' {
			inside = !inside
			continue
		}
		if !inside || b[i] != '\\' {
			continue
		}
		i++
		if i >= len(b) {
			return false
		}
		if b[i] != 'u' {
			continue
		}
		n := unit(i + 1)
		if n < 0 {
			return false
		}
		i += 4
		if n >= 0xDC00 && n <= 0xDFFF {
			return false
		}
		if n >= 0xD800 && n <= 0xDBFF {
			if i+6 >= len(b) || b[i+1] != '\\' || b[i+2] != 'u' {
				return false
			}
			low := unit(i + 3)
			if low < 0xDC00 || low > 0xDFFF {
				return false
			}
			i += 6
		}
	}
	return true
}
