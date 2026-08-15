# Design — BFF submit formId

## 根因
- BFF `POST /api/forms/:id/submit` → `callBackend('/lead/forms/:id/submit', body)` 只透传 body。
- 后端 `LeadSubmitRequest { formId @NotBlank, contact }` body。path `:id` 不注入 body → formId 空 → 400。
- 前端/e2e 只传 `{contact}`，依赖 path formId。

## 修法
- BFF submit：`body.formId = id`（注入 path）后转后端。最小 BFF 改，后端 DTO 不变。

## 决策
BFF 注入（非后端 `@PathVariable`），因 LeadSubmitRequest 设计为 body formId（含 pageId/channelId/utm 等），BFF 适配最简且不动后端契约。
