# Design — residual lead/website issues

## 问题 1：website SSR 404（三层）
1. **basePath**：nuxt.config line 12 production `baseURL=/luban-low-code/`（项目主页子路径，有意）。e2e SSR3 `WEBSITE_BASE` 不含 basePath → 302。修：e2e WEBSITE_BASE 含 `/luban-low-code/`。
2. **公开端点路径不一致**：`usePageByPath` 调 BFF `/api/public/sites/:slug/pages/by-path?path=`，但后端 `PublicController` 是 `/public/sites/:slug/pages?path=`（无 by-path 段）。修：usePageByPath 改 `/pages?path=`（最简，不动后端/BFF）。
3. **createError 404 production**：change B 已 apply `DynamicPage` error → createError。production 未生效因 usePageByPath 端点路径错（不 error）。修 ②后 error 应触发 → createError 404。

## 问题 2：merge 重复 500（功能 gap）
- `DedupService.decide(MERGE)` → ACCEPT，但 `LeadService.submit` 仍 insert → `uk_form_dedup (form_id, dedup_hash)` 唯一冲突 500。
- merge 语义：重复提交合并 contact（update 现有 lead），非 insert。
- 修：LeadService submit，`existsInWindow && policy==MERGE` → updateLead（合并 contact 字段），不 insert。需 LeadMapper 加 updateContact。

## 决策
- 问题 1：修 usePageByPath 路径（最简，1 文件）+ e2e WEBSITE_BASE（配置）+ createError 已 apply。
- 问题 2：LeadService merge update 分支（功能实现，需测试）。
