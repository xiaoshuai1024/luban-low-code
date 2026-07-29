package model

import (
	"encoding/json"
	"time"
)

// Page 对应页面实体（含 schema JSON）。
//
// Schema 使用 json.RawMessage 而非 []byte：[]byte 经 encoding/json 序列化会被
// base64 编码成字符串，破坏 BFF/website 对 schema 的嵌套对象解析（Java 端是
// JsonNode 嵌套对象）。json.RawMessage 是 []byte 的别名，但实现了 MarshalJSON
// 直接原样嵌入 JSON，从而输出嵌套对象。
//
// V2-T2: Seo 持久化页面级 SEO（与 schema 同样的 RawMessage 处理）。
type Page struct {
	ID        string          `db:"id" json:"id"`
	SiteID    string          `db:"site_id" json:"siteId"`
	Name      string          `db:"name" json:"name"`
	Path      string          `db:"path" json:"path"`
	Status    string          `db:"status" json:"status"`
	Schema    json.RawMessage `db:"schema_json" json:"schema"`
	Seo       json.RawMessage `db:"seo_json" json:"seo"`
	CreatedAt time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time       `db:"updated_at" json:"updatedAt"`
}

