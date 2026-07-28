package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/xiaoshuai1024/luban-backend-go/internal/model"
)

type SettingsRepository struct {
	db *sqlx.DB
}

func NewSettingsRepository(db *sqlx.DB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

func (r *SettingsRepository) Get(ctx context.Context) (*model.SystemSettingsRow, error) {
	var row model.SystemSettingsRow
	err := r.db.GetContext(ctx, &row, `SELECT * FROM system_settings WHERE id = 1`)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSettingsNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *SettingsRepository) Upsert(ctx context.Context, dataJSON []byte) (*model.SystemSettingsRow, error) {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
INSERT INTO system_settings (id, data_json, updated_at)
VALUES (1, ?, ?)
ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = VALUES(updated_at)
`, dataJSON, now)
	if err != nil {
		return nil, err
	}
	return &model.SystemSettingsRow{
		ID:       1,
		DataJSON: dataJSON,
		UpdatedAt: now,
	}, nil
}

