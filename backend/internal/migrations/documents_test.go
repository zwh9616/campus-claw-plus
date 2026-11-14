package migrations

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDocumentDefinitionComparison(t *testing.T) {
	b, e := files.ReadFile("document-structure.json")
	if e != nil {
		t.Fatal(e)
	}
	var all map[string]string
	if json.Unmarshal(b, &all) != nil || len(all) != 5 {
		t.Fatal("canonical snapshot")
	}
	for _, table := range documentTables {
		if all[table] == "" {
			t.Fatal("missing approved table")
		}
	}
	base := all["documents"]
	normalized := canonicalDocumentDefinition(base)
	if canonicalDocumentDefinition(strings.Replace(base, ") ENGINE=InnoDB", ") ENGINE=InnoDB AUTO_INCREMENT=123", 1)) != normalized {
		t.Fatal("next ID should not change structure")
	}
	for _, pair := range [][2]string{{"(`attempts` <= 3)", "(`attempts` <= 4)"}, {"bigint unsigned", "bigint"}, {"`id`,`class_id`,`version`", "`id`,`version`,`class_id`"}, {"utf8mb4_0900_bin", "utf8mb4_0900_ai_ci"}, {"ENGINE=InnoDB", "ENGINE=MyISAM"}, {"and (`attempts` <= 2)", "or (`attempts` <= 2)"}} {
		changed := strings.ReplaceAll(base, pair[0], pair[1])
		if changed == base {
			t.Fatal("mutation did not execute", pair[0])
		}
		if canonicalDocumentDefinition(changed) == normalized {
			t.Fatal("meaning-changing DDL normalized away", pair[0])
		}
	}
	lines := strings.Split(base, "\n")
	lines[1], lines[2] = lines[2], lines[1]
	if canonicalDocumentDefinition(strings.Join(lines, "\n")) == normalized {
		t.Fatal("column order lost")
	}
}
