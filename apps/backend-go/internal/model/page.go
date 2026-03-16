package model

import "time"

// Page 对应页面实体（含 schema JSON）
type Page struct {
	ID        string    `db:"id" json:"id"`
	SiteID    string    `db:"site_id" json:"siteId"`
	Name      string    `db:"name" json:"name"`
	Path      string    `db:"path" json:"path"`
	Status    string    `db:"status" json:"status"`
	Schema    []byte    `db:"schema_json" json:"schema"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

