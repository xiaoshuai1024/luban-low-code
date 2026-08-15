# Design — Fix engine unit tests

测试过时修复，无架构变动，不改生产代码。

## 根因分类

| 文件 | 失败数 | 根因 | 修法 |
|------|------|------|------|
| useHistory.spec.ts | 9 | 测试用旧 API（`useHistory()` 无参、`h.size`、`push(v)`/`undo(v)` 带参） | 适配新 API：`useHistory(ref(state))`、无参 push/undo、移除 size、补 snapshot/pushSnapshot |
| usePageEditorApi.spec.ts | 11 | setup 经旧 useHistory 导致 `schema.value` undefined | setup 用新 useHistory + 正确 schema ref |
| ai.spec.ts | 3 | `streamAi` 返回 AsyncGenerator，测试仍 `toBeInstanceOf(AbortController)` + timeout | for-await 消费 generator 断言事件；signal 经第 3 参；排查 timeout |
| DesignUploader.spec.ts | unhandled | jsdom 无 `URL.createObjectURL` | vitest setup stub |

## 决策

- 生产代码（`useHistory.ts` / `ai.ts`）是正确的新 API，**不动**。
- 仅更新测试以适配新 API，保持原覆盖语义。
- 不产生产品 spec delta（`skip_specs: true`）。
