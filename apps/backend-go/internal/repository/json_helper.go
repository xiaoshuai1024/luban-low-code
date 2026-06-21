package repository

import (
	"database/sql"
	"encoding/json"
)

// nullableJSON 把 json.RawMessage 转为可写入 NULL 的 sql.NullString。
//
// V2-T2/SEO 与 schema 不同：schema 默认 '{}'（页面必有结构），SEO 可为 NULL
// （旧页面无 SEO）。空 RawMessage（len==0）写 NULL，避免 MySQL JSON 列收到空串报错。
//
// 返回 interface{} 以兼容 sqlx ExecContext 的可变参数。
func nullableJSON(raw json.RawMessage) interface{} {
	if len(raw) == 0 {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: string(raw), Valid: true}
}
