# Fix BFF lead submit formId injection

## Why
e2e lead-variants / lead-capture-flow / quota-submit（7 个）失败：BFF `POST /api/forms/:id/submit` 只透传 body 不注入 path id，后端 `LeadSubmitRequest.formId`（`@NotBlank` body）为空 → 400。前端/e2e 只传 `{contact}`，依赖 path formId。

## What Changes
- BFF submit route（`apps/bff/src/app/api/forms/[id]/submit/route.ts`）：注入 `body.formId = id` 后转后端。

## Capabilities
无产品 spec 变更（BFF 转发修复）。**Opt out of spec delta（skip_specs）。**

## Impact
- 代码：BFF submit route（1 文件，+2 行）
- 验证：e2e lead-variants + lead-capture-flow（测试环境）转绿
- 风险：低
