package model

import (
	"encoding/json"
	"time"
)

// V2-T7 Collection 内容集合实体（对齐 Java Collection.java）。
// FieldSchema / Data 用 json.RawMessage（禁 []byte，避 base64）。
type Collection struct {
	ID           string          `db:"id" json:"id"`
	SiteID       string          `db:"site_id" json:"siteId"`
	Name         string          `db:"name" json:"name"`
	FieldSchema  json.RawMessage `db:"field_schema_json" json:"fieldSchema"`
	Status       string          `db:"status" json:"status"`
	CreatedAt    time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updatedAt"`
}

// CollectionItem 内容项（属于某 Collection）。
type CollectionItem struct {
	ID           string          `db:"id" json:"id"`
	CollectionID string          `db:"collection_id" json:"collectionId"`
	Data         json.RawMessage `db:"data_json" json:"data"`
	Status       string          `db:"status" json:"status"`
	CreatedAt    time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updatedAt"`
}
