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
	if !utf8.Valid(b) {
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
