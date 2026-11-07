package mysqlstore

import (
	"strings"
	"testing"
)

func TestIDFSeedRejectsAmbiguity(t *testing.T) {
	for _, raw := range []string{`null`, `{}`, `{"classes":[],"users":[]}`, `{"classes":[],"classes":[],"users":[]}`, `{"classes":[{"key":"a","name":"A"}],"users":[{"username":"u","password":"long-test-password","role":"student","class_keys":["missing"]}]}`, `{"classes":[{"key":"a","name":"A"}],"users":[{"username":"u","password":"long-test-password","role":"student","class_keys":["a","a"]}]}`} {
		if _, e := ReadSeed(strings.NewReader(raw)); e == nil {
			t.Fatal("invalid seed accepted")
		}
	}
}
