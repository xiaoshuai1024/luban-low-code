# Tasks — BFF submit formId

## T1: BFF submit route 注入 body.formId = path id
- `forms/[id]/submit/route.ts`：`const body = await req.json(); body.formId = id;` 后 callBackend
- 验证：测试环境 e2e lead-variants + lead-capture-flow 转绿
