# Design — Fix form create defaults

## 根因
- `FormService.create` line 51：`setFieldSchemaJson(toJson(req.fieldSchema()))`，fieldSchema null → toJson 返回 null。
- `forms.field_schema_json` NOT NULL（schema.sql）→ insert 违反 → 500。
- `submitConfig` 已默认 "{}"（line 52），fieldSchema 缺默认。

## 修法
- fieldSchema null → 默认 "[]"（空字段数组），与 submitConfig "{}" 对称。
- lead 400 连带（form 500 → 无 form → submit 400）：form 修后 lead 应恢复，待 e2e 验证。

## 决策
不改 e2e（创建表单允许空 fieldSchema 是合理默认）；修生产 FormService。
