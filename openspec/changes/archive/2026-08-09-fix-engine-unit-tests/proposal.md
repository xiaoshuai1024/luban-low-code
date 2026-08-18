# Fix engine unit tests

## Why

engine 单测 23/216 失败（上一轮跑全套测试发现），阻塞 TS 测试门禁（目标 85%）。根因是**测试未跟上近期重构**，非生产代码缺陷：`useHistory`/`usePageEditorApi` 的 API 已重构（构造时绑定 `current`、方法无参、移除 `size`），`streamAi` 已改为返回 `AsyncGenerator`，但对应 spec 仍用旧 API；另有 `DesignUploader` 在 jsdom 下缺 `URL.createObjectURL`。

## What Changes

- 更新 `useHistory.spec.ts`：适配新签名 `useHistory(current, opts)`、移除 `size` 断言、`push()`/`undo()` 改无参调用。
- 更新 `usePageEditorApi.spec.ts`：history/schema setup 适配新 `useHistory` API，消除 `reading 'value'`。
- 更新 `ai.spec.ts`：`streamAi` 断言改为消费 `AsyncGenerator`（for-await 事件），移除 `toBeInstanceOf(AbortController)`；排查 timed-out 用例。
- 修复 `DesignUploader.spec.ts`：jsdom 环境 stub `URL.createObjectURL`/`revokeObjectURL`。

## Capabilities

无产品能力 spec 变更（纯测试修复，不改引擎行为）。**此 change opt out of spec delta** —— 不产生 `specs/` 改动。

## Impact

- 代码：`apps/engine/src/**/__tests__/*.spec.ts`（4 个测试文件）
- 验证：`pnpm --filter ./apps/engine test` 全绿（0 failed）
- 风险：低，仅测试代码；生产代码（`useHistory.ts`/`ai.ts`）不动
