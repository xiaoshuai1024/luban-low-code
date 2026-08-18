# Tasks — Fix engine unit tests

## T1: useHistory.spec 适配新 API
- 按 `useHistory(current, opts)` 新签名重写：构造传 `ref(state)`、移除 `size` 断言、`push()`/`undo()` 无参、补 snapshot/pushSnapshot 用例
- 验证：`pnpm --filter ./apps/engine test useHistory` → 0 failed

## T2: usePageEditorApi.spec 适配新 API
- setup 用新 `useHistory(schemaRef)` 构造 + 注入正确 schema ref，消除 `reading 'value'`
- 保持 addNode/updateProp/deleteNode 等覆盖语义
- 验证：`pnpm --filter ./apps/engine test usePageEditorApi` → 0 failed

## T3: ai.spec 适配 streamAi AsyncGenerator
- `streamAi` 改为 for-await 消费 AsyncGenerator，断言 progress/confirm/error/done 事件
- 移除 `toBeInstanceOf(AbortController)`；AbortSignal 经第 3 参数传入
- 排查 timed-out 用例（fetch mock 是否 resolve）
- 验证：`pnpm --filter ./apps/engine test ai` → 0 failed

## T4: DesignUploader.spec jsdom stub
- 在 vitest setup（或 spec beforeEach）stub `URL.createObjectURL`/`revokeObjectURL`
- 验证：`pnpm --filter ./apps/engine test DesignUploader` → 0 failed

## T5: 全量验证 + 无回归
- `pnpm --filter ./apps/engine test` → 0 failed（216 全绿）
- 确认渲染器无新增 console error（引擎交付门槛）
