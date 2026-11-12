//go:build ignore

// Generate independent Go encoding/json fixture bytes, not an HTTP parser or
// a business implementation. Run with the fixture array on stdin.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
)

type payload struct {
	Answer            string `json:"answer"`
	AssignmentVersion int64  `json:"assignment_version"`
}
type vector struct {
	Name          string `json:"name"`
	Raw           string `json:"raw"`
	EquivalentRaw string `json:"equivalent_raw"`
	Canonical     string `json:"canonical"`
	SHA256        string `json:"sha256"`
}

func main() {
	var cases []vector
	if err := json.NewDecoder(os.Stdin).Decode(&cases); err != nil {
		panic("invalid fixture input")
	}
	for i := range cases {
		var a, b payload
		if json.Unmarshal([]byte(cases[i].Raw), &a) != nil || json.Unmarshal([]byte(cases[i].EquivalentRaw), &b) != nil || a != b {
			panic("fixture values differ")
		}
		canonical, err := json.Marshal(a)
		if err != nil {
			panic("fixture marshal failed")
		}
		hash := sha256.Sum256(canonical)
		cases[i].Canonical = string(canonical)
		cases[i].SHA256 = hex.EncodeToString(hash[:])
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(cases); err != nil {
		fmt.Fprintln(os.Stderr, "fixture output failed")
		os.Exit(1)
	}
}
