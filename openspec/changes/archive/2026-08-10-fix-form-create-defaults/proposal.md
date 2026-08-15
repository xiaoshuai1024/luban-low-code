# Fix form create defaults (fieldSchema)

## Why
e2e `form-api.spec` 创建表单返回 500。根因：`FormService.create` 在 `fieldSchema` 未传时写入 null，但 `forms.field_schema_json` 为 NOT NULL，insert 违反约束 → 500。连带导致 lead submit 无 form → 400。

## What Changes
- `FormService.create`：`fieldSchema` 为 null 时默认 `"[]"`（与 `submitConfig` 默认 `"{}"` 一致），满足 NOT NULL。

## Capabilities
无产品 spec 变更（缺陷修复，对齐 submitConfig 默认行为）。**Opt out of spec delta（skip_specs）。**

## Impact
- 代码：`FormService.java`（1 行）
- 验证：`mvn test`（Java17，编译 + FormService 单测）+ e2e form-api（待栈/CI）
- 风险：低
