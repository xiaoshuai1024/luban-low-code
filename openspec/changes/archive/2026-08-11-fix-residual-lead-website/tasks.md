# Tasks — residual lead/website issues

> ⚠️ 跨 website/bff/backend/e2e 4 子系统 + 含 merge 功能实现。建议 apply 时拆为：
> - **change C** `fix-website-ssr-404`（T1-T3，website+e2e）
> - **change D** `fix-lead-merge-update`（T4，backend）

## T1: usePageByPath 端点路径对齐
- `composables/usePageByPath.ts`：`/pages/by-path?path=` → `/pages?path=`（匹配后端 PublicController）
- 验证：curl BFF `/api/public/sites/:slug/pages?path=/` 返回 page 或 404

## T2: e2e WEBSITE_BASE 含 basePath
- `e2e/.env`（测试环境）：`LUBAN_E2E_WEBSITE_URL=http://192.168.100.248:3001/luban-low-code`
- 验证：e2e ssr-deep 不再 302

## T3: createError 404 production 生效（验证）
- T1 后 usePageByPath error 触发 → DynamicPage createError 404（已 apply）
- 验证：curl `/luban-low-code/{不存在 slug}/{path}` → 404；e2e ssr-deep SSR3/4 转绿

## T4: LeadService merge → update 合并
- LeadService.submit：`existsInWindow && policy==MERGE` → updateLead（合并 contact），不 insert
- LeadMapper 加 updateContact（form_id + dedup_hash → 合并 contact_json）
- 验证：merge API r2 重复 < 300（合并）；e2e lead-variants LV4 转绿；后端单测
