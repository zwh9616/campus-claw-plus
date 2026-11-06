package mysqlstore

import (
	"context"
	"database/sql"
	"errors"
	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/strictjson"
	"io"
	"slices"
	"sort"
	"time"
)

type SeedClass struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}
type SeedUser struct {
	Username  string   `json:"username"`
	Password  string   `json:"password"`
	Role      string   `json:"role"`
	ClassKeys []string `json:"class_keys"`
}
type Seed struct {
	Classes []SeedClass `json:"classes"`
	Users   []SeedUser  `json:"users"`
}

func ReadSeed(r io.Reader) (Seed, error) {
	var seed Seed
	b, e := strictjson.Read(r)
	if e != nil {
		return seed, identity.ErrInvalid
	}
	if strictjson.Decode(b, &seed) != nil || len(seed.Classes) == 0 || len(seed.Users) == 0 {
		return Seed{}, identity.ErrInvalid
	}
	return validateSeed(seed)
}
func validateSeed(seed Seed) (Seed, error) {
	if len(seed.Classes) == 0 || len(seed.Users) == 0 {
		return Seed{}, identity.ErrInvalid
	}
	classes := map[string]bool{}
	users := map[string]bool{}
	for _, c := range seed.Classes {
		if !identity.TextLength(c.Key, 1, 64) || !identity.TextLength(c.Name, 1, 128) || classes[c.Key] {
			return Seed{}, identity.ErrInvalid
		}
		classes[c.Key] = true
	}
	for _, u := range seed.Users {
		if !identity.TextLength(u.Username, 1, 64) || !identity.TextLength(u.Password, 12, 128) || users[u.Username] || (u.Role != "teacher" && u.Role != "student") || len(u.ClassKeys) == 0 || (u.Role == "student" && len(u.ClassKeys) != 1) {
			return Seed{}, identity.ErrInvalid
		}
		users[u.Username] = true
		seen := map[string]bool{}
		for _, key := range u.ClassKeys {
			if !classes[key] || seen[key] {
				return Seed{}, identity.ErrInvalid
			}
			seen[key] = true
		}
	}
	return seed, nil
}

// Initialize accepts validated input from stdin. The hook is only for in-process
// fault tests; there is no runtime configuration or HTTP endpoint for it.
func (s *Store) Initialize(ctx context.Context, seed Seed, afterMembership func() error) error {
	if _, e := validateSeed(seed); e != nil {
		return e
	}
	hashes := make([]string, len(seed.Users))
	for i, u := range seed.Users {
		h, e := identity.HashPassword(u.Password)
		if e != nil {
			return e
		}
		hashes[i] = h
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	conn, e := s.DB.Conn(ctx)
	if e != nil {
		return translated(e)
	}
	defer conn.Close()
	var locked int
	if e = conn.QueryRowContext(ctx, "SELECT GET_LOCK('campus_identity_schema',10)").Scan(&locked); e != nil || locked != 1 {
		return identity.ErrUnavailable
	}
	defer func() {
		unlock, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		conn.ExecContext(unlock, "SELECT RELEASE_LOCK('campus_identity_schema')")
	}()
	tx, e := conn.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return translated(e)
	}
	defer tx.Rollback()
	ids := map[string]string{}
	for _, c := range seed.Classes {
		var id, name string
		var active bool
		e = tx.QueryRowContext(ctx, "SELECT id,name,active FROM classes WHERE stable_key=? FOR UPDATE", c.Key).Scan(&id, &name, &active)
		if errors.Is(e, sql.ErrNoRows) {
			if _, e = tx.ExecContext(ctx, "INSERT INTO classes(stable_key,name) VALUES (?,?)", c.Key, c.Name); e != nil {
				return translated(e)
			}
			if e = tx.QueryRowContext(ctx, "SELECT id FROM classes WHERE stable_key=?", c.Key).Scan(&id); e != nil {
				return translated(e)
			}
		} else if e != nil {
			return translated(e)
		} else if name != c.Name || !active {
			return identity.ErrConflict
		}
		ids[c.Key] = id
	}
	for i, u := range seed.Users {
		var id, role string
		var enabled bool
		e = tx.QueryRowContext(ctx, "SELECT id,role,enabled FROM users WHERE username=? FOR UPDATE", u.Username).Scan(&id, &role, &enabled)
		want := append([]string{}, u.ClassKeys...)
		sort.Strings(want)
		if e == nil {
			if role != u.Role || !enabled {
				return identity.ErrConflict
			}
			rows, e := tx.QueryContext(ctx, "SELECT c.stable_key,m.active FROM class_memberships m JOIN classes c ON c.id=m.class_id WHERE m.user_id=?", id)
			if e != nil {
				return translated(e)
			}
			var got []string
			for rows.Next() {
				var k string
				var active bool
				if rows.Scan(&k, &active) != nil {
					rows.Close()
					return identity.ErrUnavailable
				}
				if !active {
					rows.Close()
					return identity.ErrConflict
				}
				got = append(got, k)
			}
			e = rows.Err()
			rows.Close()
			if e != nil {
				return translated(e)
			}
			sort.Strings(got)
			if !slices.Equal(want, got) {
				return identity.ErrConflict
			}
			continue
		}
		if !errors.Is(e, sql.ErrNoRows) {
			return translated(e)
		}
		if _, e = tx.ExecContext(ctx, "INSERT INTO users(username,password_hash,role) VALUES (?,?,?)", u.Username, hashes[i], u.Role); e != nil {
			return translated(e)
		}
		if e = tx.QueryRowContext(ctx, "SELECT id FROM users WHERE username=?", u.Username).Scan(&id); e != nil {
			return translated(e)
		}
		for _, key := range u.ClassKeys {
			if _, e = tx.ExecContext(ctx, "INSERT INTO class_memberships(user_id,class_id) VALUES (?,?)", id, ids[key]); e != nil {
				return translated(e)
			}
			if afterMembership != nil {
				if e = afterMembership(); e != nil {
					return identity.ErrUnavailable
				}
			}
		}
	}
	if tx.Commit() != nil {
		return identity.ErrTimeout
	}
	return nil
}
