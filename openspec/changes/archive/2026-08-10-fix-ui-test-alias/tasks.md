# Tasks — Fix ui test alias

## T1: apps/luban-ui vite.config 补 luban-base alias
- resolve.alias 加 `'luban-base': ../../packages/luban-base/src/index.ts`
- 验证：`cd packages/ui && pnpm exec nx test @luban-ui/luban-ui` 通过（luban-base 解析成功）
