package mysqlstore

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/zwh9616/campus-claw-plus/backend/internal/identity"
	"github.com/zwh9616/campus-claw-plus/backend/internal/materials"
)

type materialQuery interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

const materialColumns = "id,title,version,index_status,size_bytes,created_at"

func materialError(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded) {
		return identity.ErrTimeout
	}
	if errors.Is(err, sql.ErrNoRows) {
		return identity.ErrNotFound
	}
	return identity.ErrUnavailable
}
func materialScan(row interface{ Scan(...any) error }) (m materials.Material, err error) {
	var created time.Time
	err = row.Scan(&m.ID, &m.Title, &m.Version, &m.IndexStatus, &m.SizeBytes, &created)
	m.CreatedAt = created.UTC().Format("2006-01-02T15:04:05.000Z")
	return
}
func visibleMaterial(ctx context.Context, q materialQuery, p identity.Principal, id string, lock bool) (doc materials.Document, err error) {
	query := "SELECT " + materialColumns + ",body,raw_bytes FROM materials WHERE id=? AND class_id=? AND index_status<>'deleted'"
	if p.Role == "student" {
		query += " AND index_status='ready'"
	}
	if lock {
		query += " FOR UPDATE"
	}
	var at time.Time
	err = q.QueryRowContext(ctx, query, id, p.ClassID).Scan(&doc.Material.ID, &doc.Material.Title, &doc.Material.Version, &doc.Material.IndexStatus, &doc.Material.SizeBytes, &at, &doc.Body, &doc.Raw)
	doc.Material.CreatedAt = at.UTC().Format("2006-01-02T15:04:05.000Z")
	return doc, materialError(ctx, err)
}
func (s *Store) GetMaterial(ctx context.Context, p identity.Principal, id string) (materials.Document, error) {
	return visibleMaterial(ctx, s.DB, p, id, false)
}
func (s *Store) ListMaterials(ctx context.Context, p identity.Principal, page, size int) (out materials.Page, err error) {
	out = materials.Page{Items: []materials.Material{}, Page: page, PageSize: size}
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return out, materialError(ctx, err)
	}
	defer tx.Rollback()
	filter := " WHERE class_id=? AND index_status<>'deleted'"
	if p.Role == "student" {
		filter += " AND index_status='ready'"
	}
	if err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM materials"+filter, p.ClassID).Scan(&out.Total); err != nil {
		return out, materialError(ctx, err)
	}
	rows, err := tx.QueryContext(ctx, "SELECT "+materialColumns+" FROM materials"+filter+" ORDER BY id DESC LIMIT ? OFFSET ?", p.ClassID, size, (int64(page)-1)*int64(size))
	if err != nil {
		return out, materialError(ctx, err)
	}
	for rows.Next() {
		m, e := materialScan(rows)
		if e != nil {
			rows.Close()
			return out, materialError(ctx, e)
		}
		out.Items = append(out.Items, m)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, materialError(ctx, err)
	}
	return out, materialError(ctx, tx.Commit())
}
func (s *Store) materialHook(stage string, step int) error {
	if s.MaterialHook != nil {
		return s.MaterialHook(stage, step)
	}
	return nil
}
func (s *Store) CreateMaterial(ctx context.Context, p identity.Principal, key string, u materials.Upload) (m materials.Material, created bool, err error) {
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return m, false, materialError(ctx, err)
	}
	defer tx.Rollback()
	// Serialize one user's concurrent creates; the unique key is also enforced by SQL.
	var user string
	if err = tx.QueryRowContext(ctx, "SELECT id FROM users WHERE id=? FOR UPDATE", p.UserID).Scan(&user); err != nil {
		return m, false, materialError(ctx, err)
	}
	var id, digest string
	err = tx.QueryRowContext(ctx, "SELECT material_id,payload_digest FROM material_idempotency WHERE user_id=? AND class_id=? AND idempotency_key=? FOR UPDATE", p.UserID, p.ClassID, key).Scan(&id, &digest)
	if err == nil {
		if digest != u.Digest {
			return m, false, identity.ErrConflict
		}
		doc, e := visibleMaterial(ctx, tx, p, id, false)
		if e != nil {
			return m, false, e
		}
		return doc.Material, false, materialError(ctx, tx.Commit())
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return m, false, materialError(ctx, err)
	}
	result, err := tx.ExecContext(ctx, "INSERT INTO materials(class_id,created_by,title,version,index_status,raw_bytes,size_bytes,body,created_at) VALUES(?,?,?,1,'pending',?,?,?,UTC_TIMESTAMP(3))", p.ClassID, p.UserID, u.Title, u.Raw, len(u.Raw), u.Body)
	if err != nil {
		return m, false, materialError(ctx, err)
	}
	n, err := result.LastInsertId()
	if err != nil || n <= 0 {
		return m, false, identity.ErrUnavailable
	}
	id = strconv.FormatInt(n, 10)
	if err = s.materialHook("create", 1); err != nil {
		return m, false, identity.ErrUnavailable
	}
	_, err = tx.ExecContext(ctx, "INSERT INTO material_idempotency(user_id,class_id,idempotency_key,payload_digest,material_id,material_version) VALUES(?,?,?,?,?,1)", p.UserID, p.ClassID, key, u.Digest, id)
	if err != nil {
		return m, false, materialError(ctx, err)
	}
	if err = s.materialHook("create", 2); err != nil {
		return m, false, identity.ErrUnavailable
	}
	doc, err := visibleMaterial(ctx, tx, p, id, false)
	if err != nil {
		return m, false, err
	}
	if err = tx.Commit(); err != nil {
		return m, false, identity.ErrTimeout
	}
	return doc.Material, true, nil
}
func (s *Store) IndexMaterial(ctx context.Context, p identity.Principal, id string) (out materials.Material, err error) {
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return out, materialError(ctx, err)
	}
	defer tx.Rollback()
	doc, err := visibleMaterial(ctx, tx, p, id, true)
	if err != nil {
		return out, err
	}
	if doc.Material.IndexStatus == "ready" {
		return doc.Material, materialError(ctx, tx.Commit())
	}
	_, err = tx.ExecContext(ctx, "UPDATE materials SET index_status='indexing' WHERE id=? AND class_id=? AND version=1", id, p.ClassID)
	if err == nil {
		_, err = tx.ExecContext(ctx, "DELETE FROM material_chunks WHERE material_id=? AND class_id=? AND material_version=1", id, p.ClassID)
	}
	if err == nil {
		for _, chunk := range materials.Chunks(doc.Body) {
			_, err = tx.ExecContext(ctx, "INSERT INTO material_chunks(class_id,material_id,material_version,ordinal,char_start,char_end,quote) VALUES(?,?,1,?,?,?,?)", p.ClassID, id, chunk.Ordinal, chunk.Start, chunk.End, chunk.Quote)
			if err == nil {
				err = s.materialHook("index", chunk.Ordinal+1)
			}
			if err != nil {
				break
			}
		}
	}
	if err == nil {
		_, err = tx.ExecContext(ctx, "UPDATE materials SET index_status='ready' WHERE id=? AND class_id=? AND version=1", id, p.ClassID)
	}
	if err != nil {
		// Rollback is complete before marking failed; never overwrite another ready commit.
		tx.Rollback()
		_, markErr := s.DB.ExecContext(ctx, "UPDATE materials SET index_status='failed' WHERE id=? AND class_id=? AND version=1 AND index_status IN ('pending','failed')", id, p.ClassID)
		if markErr != nil {
			return out, materialError(ctx, markErr)
		}
		current, e := visibleMaterial(ctx, s.DB, p, id, false)
		return current.Material, e
	}
	if err = tx.Commit(); err != nil {
		return out, identity.ErrTimeout
	}
	doc.Material.IndexStatus = "ready"
	return doc.Material, nil
}
func (s *Store) SearchMaterials(ctx context.Context, p identity.Principal, q string, top int) (out materials.SearchResult, err error) {
	out = materials.SearchResult{Items: []materials.Citation{}, Mode: "keyword"}
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return out, materialError(ctx, err)
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT c.material_id,c.id,c.material_version,m.title,c.ordinal,c.char_start,c.char_end,c.quote
FROM material_chunks c JOIN materials m ON m.id=c.material_id
WHERE c.class_id=? AND m.class_id=? AND m.index_status='ready' AND INSTR(CAST(c.quote AS BINARY),CAST(? AS BINARY))>0
ORDER BY m.id DESC,c.ordinal ASC,c.id ASC LIMIT ?`, p.ClassID, p.ClassID, q, top)
	if err != nil {
		return out, materialError(ctx, err)
	}
	var candidates []materials.Citation
	for rows.Next() {
		var c materials.Citation
		if err = rows.Scan(&c.MaterialID, &c.ChunkID, &c.MaterialVersion, &c.Title, &c.Ordinal, &c.CharStart, &c.CharEnd, &c.Quote); err != nil {
			rows.Close()
			return out, materialError(ctx, err)
		}
		c.URL = "/api/v1/materials/" + c.MaterialID
		candidates = append(candidates, c)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, materialError(ctx, err)
	}
	for _, c := range candidates {
		doc, e := visibleMaterial(ctx, tx, p, c.MaterialID, false)
		if errors.Is(e, identity.ErrNotFound) {
			continue
		}
		if e != nil {
			return out, e
		}
		if doc.Material.IndexStatus != "ready" || !materials.CheckCitation(c, doc) {
			return out, identity.ErrUnavailable
		}
		out.Items = append(out.Items, c)
	}
	return out, materialError(ctx, tx.Commit())
}
