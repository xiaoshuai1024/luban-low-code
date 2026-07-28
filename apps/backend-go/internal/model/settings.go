package model

import "time"

// SystemSettingsRow 存储系统设置的单行 JSON
type SystemSettingsRow struct {
	ID       int       `db:"id" json:"id"`
	DataJSON []byte    `db:"data_json" json:"dataJson"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

