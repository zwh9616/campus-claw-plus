package strictjson

import (
	"bytes"
	"strings"
	"testing"
)

func TestIDFStrictInput(t *testing.T) {
	for _, b := range []string{`{"A":1}`, `{"a":1,"A":2}`, `{"a":null}`, `null`} {
		var v struct {
			A int `json:"a"`
		}
		if Decode([]byte(b), &v) == nil {
			t.Fatal("case alias or null accepted")
		}
	}
	for _, b := range [][]byte{[]byte(`{"a":1,"a":2}`), []byte(`{"a":1,"\u0061":2}`), []byte(`{"other":1}`), []byte(`{"a":1} {}`), {0xff}, []byte(`{"a":"1"}`)} {
		var v struct {
			A int `json:"a"`
		}
		if Decode(b, &v) == nil {
			t.Fatal("ambiguous input accepted")
		}
	}
	var v struct {
		A int `json:"a"`
	}
	if Decode([]byte(`{"a":1}`), &v) != nil || v.A != 1 {
		t.Fatal("valid input")
	}
	if _, e := Read(strings.NewReader(strings.Repeat(" ", 65536))); e != nil {
		t.Fatal("64KiB boundary")
	}
	if _, e := Read(bytes.NewReader(make([]byte, 65537))); e != ErrTooLarge {
		t.Fatal("64KiB+1")
	}
}

func TestATUnicodeScalarsAndRawNumberTypes(t *testing.T) {
	for _, raw := range []string{`{"a":"\ud800"}`, `{"a":"\udfff"}`, `{"a":"\ud842x\udfb7"}`, `{"a":"\ud842\u0041"}`} {
		var out struct {
			A string `json:"a"`
		}
		if Decode([]byte(raw), &out) == nil {
			t.Fatal("lone surrogate silently replaced")
		}
	}
	for _, raw := range []string{`{"a":"\ud842\udfb7"}`, `{"a":"𠮷�"}`, `{"a":"\\ud800"}`} {
		var out struct {
			A string `json:"a"`
		}
		if Decode([]byte(raw), &out) != nil {
			t.Fatal("valid scalar/literal backslash rejected")
		}
	}
}
