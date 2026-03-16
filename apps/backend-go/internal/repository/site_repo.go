package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

type SiteRepository struct {
	db *sqlx.DB
}

func NewSiteRepository(db *sqlx.DB) *SiteRepository {
	return &SiteRepository{db: db}
}

func (r *SiteRepository) List(ctx context.Context) ([]*model.Site, error) {
	var sites []*model.Site
	if err := r.db.SelectContext(ctx, &sites, `SELECT * FROM sites ORDER BY created_at DESC`); err != nil {
		return nil, err
	}
	return sites, nil
}

func (r *SiteRepository) Get(ctx context.Context, id string) (*model.Site, error) {
	var s model.Site
	err := r.db.GetContext(ctx, &s, `SELECT * FROM sites WHERE id = ?`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSiteNotFound
		}
		return nil, err
	}
	return &s, nil
}

func (r *SiteRepository) Create(ctx context.Context, s *model.Site) error {
	now := time.Now()
	s.CreatedAt = now
	s.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
INSERT INTO sites (id, name, slug, base_url, status, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.Name, s.Slug, s.BaseURL, s.Status, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		if isDuplicateErr(err) {
			return ErrSlugConflict
		}
		return err
	}
	return nil
}

func (r *SiteRepository) Update(ctx context.Context, s *model.Site) error {
	s.UpdatedAt = time.Now()
	res, err := r.db.ExecContext(ctx, `
UPDATE sites SET name=?, slug=?, base_url=?, status=?, updated_at=? WHERE id=?`,
		s.Name, s.Slug, s.BaseURL, s.Status, s.UpdatedAt, s.ID,
	)
	if err != nil {
		if isDuplicateErr(err) {
			return ErrSlugConflict
		}
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrSiteNotFound
	}
	return nil
}

func (r *SiteRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM sites WHERE id=?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrSiteNotFound
	}
	return nil
}

func isDuplicateErr(err error) bool {
	if err == nil {
		return false
	}
	// 简单通过错误信息里的 "Duplicate entry" 判断，够用即可
	return strings.Contains(err.Error(), "Duplicate entry")
}

