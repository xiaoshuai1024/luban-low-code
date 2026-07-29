package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

// V2-T7 Collection + CollectionItem 仓储。
// 显式列名（避免 SELECT * 列顺序敏感）。
const (
	collectionColumns     = `id, site_id, name, field_schema_json, status, created_at, updated_at`
	collectionItemColumns = `id, collection_id, data_json, status, created_at, updated_at`
)

type CollectionRepository struct {
	db *sqlx.DB
}

func NewCollectionRepository(db *sqlx.DB) *CollectionRepository {
	return &CollectionRepository{db: db}
}

// === Collection ===

func (r *CollectionRepository) ListBySite(ctx context.Context, siteID string) ([]*model.Collection, error) {
	var list []*model.Collection
	if err := r.db.SelectContext(ctx, &list,
		`SELECT `+collectionColumns+` FROM collections WHERE site_id = ? ORDER BY updated_at DESC`, siteID); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *CollectionRepository) Get(ctx context.Context, siteID, id string) (*model.Collection, error) {
	var c model.Collection
	err := r.db.GetContext(ctx, &c,
		`SELECT `+collectionColumns+` FROM collections WHERE id = ? AND site_id = ?`, id, siteID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrCollectionNotFound
		}
		return nil, err
	}
	return &c, nil
}

func (r *CollectionRepository) Create(ctx context.Context, c *model.Collection) error {
	now := time.Now()
	c.CreatedAt = now
	c.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
INSERT INTO collections (id, site_id, name, field_schema_json, status, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.SiteID, c.Name, nullableJSON(c.FieldSchema), c.Status, c.CreatedAt, c.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return ErrCollectionNameConflict
		}
		return err
	}
	return nil
}

func (r *CollectionRepository) Update(ctx context.Context, c *model.Collection) error {
	c.UpdatedAt = time.Now()
	res, err := r.db.ExecContext(ctx, `
UPDATE collections SET name=?, field_schema_json=?, status=?, updated_at=? WHERE id=? AND site_id=?`,
		c.Name, nullableJSON(c.FieldSchema), c.Status, c.UpdatedAt, c.ID, c.SiteID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return ErrCollectionNameConflict
		}
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrCollectionNotFound
	}
	return nil
}

func (r *CollectionRepository) Delete(ctx context.Context, siteID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM collections WHERE id=? AND site_id=?`, id, siteID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrCollectionNotFound
	}
	return nil
}

// === CollectionItem ===

func (r *CollectionRepository) ListItems(ctx context.Context, collectionID string) ([]*model.CollectionItem, error) {
	var list []*model.CollectionItem
	if err := r.db.SelectContext(ctx, &list,
		`SELECT `+collectionItemColumns+` FROM collection_items WHERE collection_id = ? ORDER BY updated_at DESC`, collectionID); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *CollectionRepository) GetItem(ctx context.Context, collectionID, itemID string) (*model.CollectionItem, error) {
	var it model.CollectionItem
	err := r.db.GetContext(ctx, &it,
		`SELECT `+collectionItemColumns+` FROM collection_items WHERE id = ? AND collection_id = ?`, itemID, collectionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrCollectionItemNotFound
		}
		return nil, err
	}
	return &it, nil
}

func (r *CollectionRepository) CreateItem(ctx context.Context, it *model.CollectionItem) error {
	now := time.Now()
	it.CreatedAt = now
	it.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
INSERT INTO collection_items (id, collection_id, data_json, status, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`,
		it.ID, it.CollectionID, nullableJSON(it.Data), it.Status, it.CreatedAt, it.UpdatedAt,
	)
	return err
}

func (r *CollectionRepository) UpdateItem(ctx context.Context, it *model.CollectionItem) error {
	it.UpdatedAt = time.Now()
	res, err := r.db.ExecContext(ctx, `
UPDATE collection_items SET data_json=?, status=?, updated_at=? WHERE id=? AND collection_id=?`,
		nullableJSON(it.Data), it.Status, it.UpdatedAt, it.ID, it.CollectionID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrCollectionItemNotFound
	}
	return nil
}

func (r *CollectionRepository) DeleteItem(ctx context.Context, collectionID, itemID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM collection_items WHERE id=? AND collection_id=?`, itemID, collectionID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrCollectionItemNotFound
	}
	return nil
}
