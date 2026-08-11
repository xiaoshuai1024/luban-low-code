# Design — website SSR 404

## 根因
- `router/routes.ts` `/:site/:path*` → DynamicPage（任何 `/{site}/{path}` 进）。
- DynamicPage `usePageByPath(slug, path)` error（page 不存在）只 setPage，不 createError → 渲染 200。
- 应 SSR 404（SEO + 正确性）。

## 修法
- DynamicPage watch error → `throw createError({statusCode:404, fatal:true})`。Nuxt SSR fatal error → 404 响应。
- usePageByPath 初始 loading（error undefined），fetch 完才 error → watch 触发 createError。

## 决策
createError fatal（非渲染兜底），保证 SSR HTTP 404。
