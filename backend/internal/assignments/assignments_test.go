package assignments

import (
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/strictjson"
)

//go:embed testdata/assignment-digest-cases.json
var digestVectors []byte

func TestATInputBoundariesAndCanonicalDigest(t *testing.T) {
	for _, raw := range []string{"1", "1.0", "10e-1", "0.01e2", " 1 ", "18446744073709551615", "1e999999999999999999999999999"} {
		v, e := PositiveVersion([]byte(raw))
		if e != nil || (!v.Large && v.Value == 0) {
			t.Fatal("valid positive integral version rejected", raw)
		}
	}
	for _, raw := range []string{"0", "-1", "1.01", "1e-99999999999999999999999", "null", "true", `"1"`, "[]", "{}", "01", "1e", "1.0001e0"} {
		if _, e := PositiveVersion([]byte(raw)); e == nil {
			t.Fatal("invalid version accepted", raw)
		}
	}
	a, _ := PositiveVersion([]byte("1.000e0"))
	if !a.Matches(1) {
		t.Fatal("equivalent numeric JSON changed value")
	}
	big, _ := PositiveVersion([]byte("18446744073709551616"))
	if !big.Large || big.Matches(1) {
		t.Fatal("large integral version truncated")
	}
	for _, s := range []string{"aaaaaaaaaaaaaaaa", "Aaaaaaaaaaaaaaaa ", strings.Repeat("!", 64)} {
		if !ValidKey(s) {
			t.Fatal("printable ASCII key rejected")
		}
	}
	for _, s := range []string{strings.Repeat("a", 15), strings.Repeat("a", 65), "aaaaaaaaaaaaaaa\n", "aaaaaaaaaaaaaaa界"} {
		if ValidKey(s) {
			t.Fatal("invalid key accepted")
		}
	}
	in := CreateInput{Title: strings.Repeat("𠮷", 200), Description: " \n正文\n ", Deadline: "2035-01-01T00:00:00.000Z"}
	if !ValidCreate(in) {
		t.Fatal("nonBMP inclusive title/raw description")
	}
	for _, change := range []func(*CreateInput){func(v *CreateInput) { v.Title += "x" }, func(v *CreateInput) { v.Title = " \t\n" }, func(v *CreateInput) { v.Description = "\u3000" }, func(v *CreateInput) { v.Deadline = "2035-01-01T00:00:00Z" }} {
		copy := in
		change(&copy)
		if ValidCreate(copy) {
			t.Fatal("invalid creation input")
		}
	}
	raw := digestVectors
	var cases []struct {
		Raw        string `json:"raw"`
		Equivalent string `json:"equivalent_raw"`
		SHA        string `json:"sha256"`
	}
	if json.Unmarshal(raw, &cases) != nil || len(cases) != 5 {
		t.Fatal("vectors")
	}
	for _, tc := range cases {
		for _, wire := range []string{tc.Raw, tc.Equivalent} {
			var input struct {
				Answer  string          `json:"answer"`
				Version json.RawMessage `json:"assignment_version"`
			}
			if strictjson.Decode([]byte(wire), &input) != nil {
				t.Fatal("valid scalar input")
			}
			v, e := PositiveVersion(input.Version)
			if e != nil {
				t.Fatal("vector version")
			}
			sum := Digest(SubmitInput{input.Answer, v})
			if hex.EncodeToString(sum[:]) != tc.SHA {
				t.Fatal("AT-SC-06 payload digest drifted")
			}
		}
	}
}
func TestATIndependentUserQuota(t *testing.T) {
	now := time.Unix(125, 500000000)
	l := NewLimiter(func() time.Time { return now })
	for i := 0; i < 12; i++ {
		if ok, _ := l.Allow("same-user"); !ok {
			t.Fatal("quota premature")
		}
	}
	if ok, retry := l.Allow("same-user"); ok || retry != 55 {
		t.Fatal("quota/remaining fixed window")
	}
	if ok, _ := l.Allow("another-user"); !ok {
		t.Fatal("other subject rate limited")
	}
	now = time.Unix(180, 0)
	if ok, _ := l.Allow("same-user"); !ok {
		t.Fatal("new fixed window did not reset")
	}
}
