# Fix ui test alias (luban-base npm name)

## Why
ui 单测（`nx test @luban-ui/luban-ui`）失败：`Failed to resolve import "luban-base"`。根因：`apps/luban-ui/vite.config.mts` 的 resolve.alias 只有 `@luban-ui/luban-base`（带 scope），但 `registry.ts` 按 ui 规范用正式 npm 包名 `import from 'luban-base'`（无 scope），alias 不匹配 → 解析失败。

## What Changes
- `apps/luban-ui/vite.config.mts` resolve.alias 补 `'luban-base'` → `packages/luban-base/src/index.ts`（与 `@luban-ui/luban-base` 同源码）。

## Capabilities
无产品 spec 变更（测试配置修复）。**Opt out of spec delta（skip_specs）。**

## Impact
- 代码：`packages/ui/apps/luban-ui/vite.config.mts`（+4 行 alias）
- 验证：`nx test @luban-ui/luban-ui` 通过
- 风险：低
