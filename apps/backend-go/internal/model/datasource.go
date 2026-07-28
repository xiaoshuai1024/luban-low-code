package model

import (
	"encoding/json"
	"time"
)

// Datasource mirrors the datasources table.
//
// Config uses json.RawMessage (not []byte) so encoding/json embeds it as a nested
// object — []byte would be base64-encoded by the default marshaler and break the
// BFF/engine contract (same lesson as model.Page.Schema; see page_test.go Bug1
// regression). Aligned with Java entity.Datasource (configJson as String) and the
// shared §9.3 DDL.
type Datasource struct {
	ID        string          `db:"id" json:"id"`
	SiteID    string          `db:"site_id" json:"siteId"`
	Name      string          `db:"name" json:"name"`
	Type      string          `db:"type" json:"type"`
	Config    json.RawMessage `db:"config_json" json:"config"`
	CreatedAt time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time       `db:"updated_at" json:"updatedAt"`
}
