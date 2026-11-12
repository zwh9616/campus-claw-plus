// identity-admin is an offline stdin-only entry point. No credential arguments.
package main

import (
	"context"
	"fmt"
	"github.com/zwh9616/campus-claw-plus/backend/internal/migrations"
	"github.com/zwh9616/campus-claw-plus/backend/internal/mysqlstore"
	"os"
	"strconv"
)

func main() { os.Exit(run()) }
func run() int {
	if len(os.Args) < 2 || len(os.Args) > 3 {
		fmt.Fprintln(os.Stderr, "usage: identity-admin migrate|check|initialize|repair VERSION")
		return 2
	}
	action := os.Args[1]
	if action != "migrate" && action != "check" && action != "initialize" && action != "repair" {
		return 2
	}
	version := migrations.Target
	if action == "repair" {
		if len(os.Args) != 3 {
			return 2
		}
		n, e := strconv.Atoi(os.Args[2])
		if e != nil || n < 1 || n > migrations.Target {
			return 2
		}
		version = n
	} else if len(os.Args) != 2 {
		return 2
	}
	db, e := mysqlstore.OpenEnvironment(os.LookupEnv, true)
	if e != nil {
		fmt.Fprintln(os.Stderr, "offline configuration invalid")
		return 2
	}
	defer db.Close()
	ctx := context.Background()
	var database string
	if db.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&database) != nil {
		fmt.Fprintln(os.Stderr, "database unavailable")
		return 1
	}
	executor := migrations.Executor{DB: db, Database: database}
	switch action {
	case "migrate":
		e = executor.Up(ctx, migrations.Target)
	case "check":
		e = executor.Check(ctx, migrations.Target)
	case "repair":
		e = executor.Repair(ctx, version)
	case "initialize":
		e = executor.Check(ctx, migrations.Target)
		if e == nil {
			seed, parseErr := mysqlstore.ReadSeed(os.Stdin)
			e = parseErr
			if e == nil {
				e = (&mysqlstore.Store{DB: db}).Initialize(ctx, seed, nil)
			}
		}
	}
	if e != nil {
		fmt.Fprintln(os.Stderr, "identity administration failed; inspect migration state before retrying")
		return 1
	}
	fmt.Println("identity administration completed")
	return 0
}
