# Fix residual lead/website issues

## Why
hand-testing 后 2 个剩余问题:
1. **website SSR 404**(e2e ssr-deep SSR3/4 fail):production `app.baseURL=/luban-low-code/`(项目主页子路径,有意)→ e2e `WEBSITE_BASE` 不含 basePath 必 302;且 `usePageByPath` 调 BFF `/pages/by-path` 但后端 `PublicController` 是 `/pages?path=`(路径不一致,需对齐);createError 404 已 apply(change B)但 production 未生效。
2. **merge 留资重复 500**:LeadService `merge` 策略仍 `insert`,触发 `leads.uk_form_dedup` 唯一约束冲突(merge 应 update 合并,功能 gap)。

## What Changes
- 对齐公开页端点:`usePageByPath` 改 `/pages?path=`(匹配后端 PublicController),或 BFF 加 `/pages/by-path` 代理。
- e2e `WEBSITE_BASE` 含 basePath(`/luban-low-code/`,production baseURL)。
- DynamicPage createError 404 production 生效(依赖 usePageByPath error 触发)。
- LeadService `merge` → update 合并现有 lead(非 insert),LeadMapper 加 update contact。

## Capabilities
无产品 spec 变更(缺陷/功能修复)。**Opt out of spec delta(skip_specs)。**

## Impact
- 跨 website/bff/backend-java/e2e;createError 404 已 apply(change B);merge 为功能实现
- ⚠️ **超出 openspec 单 change 范围**(跨 4 子系统 + 含功能);config 建议 Superpowers 或 apply 时拆为 2 change(website-ssr404 / lead-merge)
