package config

import (
	"strings"
	"testing"
)

// PB-03 / SC-04..06: normal, failure and boundary classes.
func TestReadPort(t *testing.T) {
	for _, test := range []struct {
		name, value, want string
		exists, valid     bool
	}{
		{"normal", "8080", "8080", true, true},
		{"trim", " 8080 \t", "8080", true, true},
		{"minimum", "1", "1", true, true},
		{"maximum", "65535", "65535", true, true},
		{"leading_zero", "08080", "8080", true, true},
		{"missing", "", "", false, false},
		{"empty", "", "", true, false},
		{"whitespace", " \t ", "", true, false},
		{"letters", "abc", "", true, false},
		{"zero", "0", "", true, false},
		{"negative", "-1", "", true, false},
		{"above_max", "65536", "", true, false},
		{"plus", "+8080", "", true, false},
		{"unicode", "８０８０", "", true, false},
		{"overflow", "999999999999999999999999", "", true, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := ReadPort(func(string) (string, bool) { return test.value, test.exists })
			if test.valid {
				if err != nil || got != test.want {
					t.Fatalf("got %q, %v; want %q", got, err, test.want)
				}
			} else if err == nil || !strings.Contains(err.Error(), "HTTP_PORT") {
				t.Fatalf("invalid input accepted or missing actionable key: %q %v", got, err)
			}
		})
	}
}
