package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

// DatasourceRepository is the data-access layer for the datasources table.
//
// Multi-tenant isolation is enforced at the SQL layer: ListBySite and every
// create/get-by-id path carry site_id (or rely on the caller seeding the right
// row). Aligned with Java DatasourceMapper.
type DatasourceRepository struct {
	db *sqlx.DB
}

func NewDatasourceRepository(db *sqlx.DB) *DatasourceRepository {
	return &DatasourceRepository{db: db}
}

// ListBySite returns all datasources owned by siteID, newest first.
func (r *DatasourceRepository) ListBySite(ctx context.Context, siteID string) ([]*model.Datasource, error) {
	var list []*model.Datasource
	if err := r.db.SelectContext(ctx, &list,
		`SELECT id, site_id, name, type, config_json, created_at, updated_at FROM datasources WHERE site_id = ? ORDER BY updated_at DESC`,
		siteID); err != nil {
		return nil, err
	}
	return list, nil
}

// Get returns a single datasource by id. Missing → ErrDatasourceNotFound.
func (r *DatasourceRepository) Get(ctx context.Context, id string) (*model.Datasource, error) {
	var d model.Datasource
	err := r.db.GetContext(ctx, &d,
		`SELECT id, site_id, name, type, config_json, created_at, updated_at FROM datasources WHERE id = ?`,
		id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrDatasourceNotFound
		}
		return nil, err
	}
	return &d, nil
}

// GetBySiteID returns a datasource only if it belongs to siteID. A wrong-tenant id
// is indistinguishable from a missing row (no information leak). Aligned with the
// Java getByIdAndSiteId mapper method.
func (r *DatasourceRepository) GetBySiteID(ctx context.Context, id, siteID string) (*model.Datasource, error) {
	var d model.Datasource
	err := r.db.GetContext(ctx, &d,
		`SELECT id, site_id, name, type, config_json, created_at, updated_at FROM datasources WHERE id = ? AND site_id = ?`,
		id, siteID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrDatasourceNotFound
		}
		return nil, err
	}
	return &d, nil
}

// Create inserts a new datasource. Duplicate (site_id, name) → ErrDatasourceNameConflict.
func (r *DatasourceRepository) Create(ctx context.Context, d *model.Datasource) error {
	now := time.Now()
	d.CreatedAt = now
	d.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
INSERT INTO datasources (id, site_id, name, type, config_json, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
		d.ID, d.SiteID, d.Name, d.Type, d.Config, d.CreatedAt, d.UpdatedAt,
	)
	if err != nil {
		if isDuplicateErr(err) {
			return ErrDatasourceNameConflict
		}
		return err
	}
	return nil
}

// Update overwrites the mutable fields. site_id is intentionally NOT in the SET
// clause (a row's tenant never changes) and is added to the WHERE as a multi-tenant
// guard; 0 rows affected (wrong id OR wrong site_id) → ErrDatasourceNotFound.
// Duplicate (site_id, name) on a new name → ErrDatasourceNameConflict.
func (r *DatasourceRepository) Update(ctx context.Context, d *model.Datasource) error {
	d.UpdatedAt = time.Now()
	res, err := r.db.ExecContext(ctx, `
UPDATE datasources SET name=?, type=?, config_json=?, updated_at=? WHERE id=? AND site_id=?`,
		d.Name, d.Type, d.Config, d.UpdatedAt, d.ID, d.SiteID,
	)
	if err != nil {
		if isDuplicateErr(err) {
			return ErrDatasourceNameConflict
		}
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrDatasourceNotFound
	}
	return nil
}

// Delete removes a datasource. 0 rows affected → ErrDatasourceNotFound.
func (r *DatasourceRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM datasources WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrDatasourceNotFound
	}
	return nil
}

// DeleteBySiteID removes a datasource only if it belongs to siteID (multi-tenant
// guard at the SQL layer). 0 rows → ErrDatasourceNotFound.
func (r *DatasourceRepository) DeleteBySiteID(ctx context.Context, id, siteID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM datasources WHERE id = ? AND site_id = ?`, id, siteID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrDatasourceNotFound
	}
	return nil
}
