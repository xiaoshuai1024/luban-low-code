# Fix website SSR 404 for missing pages

## Why
website SSR 对不存在 slug/path 返回 200（e2e ssr-deep SSR3/4 失败）。根因：`/:site/:path*` 路由进 DynamicPage，`usePageByPath` error 只 setPage 不 createError 404，故渲染空页 200。

## What Changes
- `views/DynamicPage.vue`：error（公开页不存在）时 `createError({statusCode:404, fatal:true})`，SSR 返回 404。

## Capabilities
无产品 spec 变更（SSR 行为修复）。**Opt out of spec delta（skip_specs）。**

## Impact
- 代码：`apps/website/views/DynamicPage.vue`（1 处 watch）
- 验证：e2e ssr-deep SSR3/4（不存在 slug/path → 404）转绿
- 风险：低
