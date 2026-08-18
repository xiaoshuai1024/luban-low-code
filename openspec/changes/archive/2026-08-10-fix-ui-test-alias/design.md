# Design — Fix ui test alias

## 根因
- ui 规范：对外 npm 包名无 scope（`luban-base`），内部可用 `@luban-ui/*` alias。
- `registry.ts` import `'luban-base'`（npm 名，正确）。
- `apps/luban-ui/vite.config.mts` alias 缺 `'luban-base'`（只有 `@luban-ui/luban-base`）→ vitest resolve 失败。
- `luban-low-code/vite.config.mts:24` 有 `'luban-base'` → dist alias，apps/luban-ui 缺。

## 修法
- apps/luban-ui 补 `'luban-base'` → `src/index.ts`（源码，与 @luban-ui/luban-base 对称，无需 build dist）。

## 决策
指向 src（源码），不依赖 build 产物，与现有 @luban-ui/luban-base alias 一致。
