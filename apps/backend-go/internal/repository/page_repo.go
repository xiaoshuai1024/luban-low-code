package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

type PageRepository struct {
	db *sqlx.DB
}

func NewPageRepository(db *sqlx.DB) *PageRepository {
	return &PageRepository{db: db}
}

func (r *PageRepository) ListBySite(ctx context.Context, siteID string) ([]*model.Page, error) {
	var pages []*model.Page
	if err := r.db.SelectContext(ctx, &pages, `SELECT * FROM pages WHERE site_id = ? ORDER BY updated_at DESC`, siteID); err != nil {
		return nil, err
	}
	return pages, nil
}

func (r *PageRepository) Get(ctx context.Context, siteID, pageID string) (*model.Page, error) {
	var p model.Page
	err := r.db.GetContext(ctx, &p, `SELECT * FROM pages WHERE id = ? AND site_id = ?`, pageID, siteID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPageNotFound
		}
		return nil, err
	}
	return &p, nil
}

// GetPublishedBySiteAndPath 按 site_id + path 获取已发布页面（status='published'）。
//
// 对齐 Java PageMapper.getBySiteIdAndPathPublished：
//   SELECT ... FROM pages WHERE site_id=? AND path=? AND status='published'
// 仅供公开接口 /backend/public/sites/:slug/pages 使用，保证未发布页面绝不外泄。
// 未命中（草稿/不存在）一律返回 ErrPageNotFound，不区分原因（防止信息泄露）。
func (r *PageRepository) GetPublishedBySiteAndPath(ctx context.Context, siteID, path string) (*model.Page, error) {
	var p model.Page
	err := r.db.GetContext(ctx, &p, `SELECT * FROM pages WHERE site_id = ? AND path = ? AND status = 'published'`, siteID, path)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPageNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *PageRepository) Create(ctx context.Context, p *model.Page) error {
	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
INSERT INTO pages (id, site_id, name, path, status, schema_json, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.SiteID, p.Name, p.Path, p.Status, p.Schema, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return ErrPagePathConflict
		}
		return err
	}
	return nil
}

func (r *PageRepository) Update(ctx context.Context, p *model.Page) error {
	p.UpdatedAt = time.Now()
	res, err := r.db.ExecContext(ctx, `
UPDATE pages SET name=?, path=?, status=?, schema_json=?, updated_at=? WHERE id=? AND site_id=?`,
		p.Name, p.Path, p.Status, p.Schema, p.UpdatedAt, p.ID, p.SiteID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return ErrPagePathConflict
		}
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrPageNotFound
	}
	return nil
}

func (r *PageRepository) Delete(ctx context.Context, siteID, pageID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM pages WHERE id=? AND site_id=?`, pageID, siteID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrPageNotFound
	}
	return nil
}

