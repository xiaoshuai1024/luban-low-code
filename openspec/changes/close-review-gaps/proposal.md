# Proposal: close-review-gaps

## Why

2026-08-14 六路并行 review（engine/BFF/Java/UI/website/横切面）发现：除官网外的各子系统存在安全级缺陷（鉴权头旁路、越权导出）、真实功能缺陷（删页面 500、撤销失效、UI 测试红灯）、三层未实现的 form DELETE 被登记为完成、CI 结构性假绿，以及生产配置未入库等工程漂移。本 change 一次性收口这些问题，恢复"信息真实 + 测试门禁真实"的底线。

## What Changes

- **安全收口**：Java AuthFilter 引入 BFF↔后端共享密钥校验（杜绝 `X-User-*` 头伪造）；leads 导出限 admin；datasource testConnection 限 admin；BFF 登录加速率限制；e2e compose 注入 `AUTH_JWT_SECRET`；`/backend/healthz` 匿名放行
- **Java 功能缺陷**：PageService.delete 级联清理 forms（避免 FK 500）；SiteService 级联删除加 `@Transactional`；lead 去重唯一键冲突捕获转 409/静默去重（消除竞态 500）
- **form DELETE 三层补齐（T24）**：Java `@DeleteMapping`（含 FORM_HAS_LEADS 409 校验）→ BFF DELETE handler → engine `deleteForm` API + FormList 真删除
- **engine 缺陷**：属性/样式/事件撤销快照时序修复（先快照后变更）；切页/切站时 `history.reset()` 清空撤销栈；`usePageEditorApi.ts` GBK→UTF-8 乱码修复；`normalizeDatasourceError` 接入 PageEditor；Dashboard 页面数改真实统计、移除调试 console.log
- **UI 修复**：material-parity 计数 34→39 回绿；`'luban-base'` 裸导入统一改为 `@luban-low-code/luban-base`（30+ 处 + rollup external）；引入 highlight.js 主题 CSS；BackToTop `duration` prop 实装或移除；CodeBlock maxHeight 改可滚动
- **CI 门禁重建**：e2e-cross 去除 `continue-on-error`/`|| echo`/submodule/Go 残留；新增单测+构建 workflow（pnpm test / mvn verify 分栈）
- **工程对账**：未提交生产配置与 openspec 归档一次 commit；任务图假 done 对账（T24→done、T22→todo、ST-001→还原真实状态、mcp-server 22 条→done）；删除 `apps/backend-go` 及脚本/skill 中的 Go 残留引用；CLAUDE.md 路径表修正为实际目录；删除 stub 脚本或标注未实现

## Capabilities

### New Capabilities

（无 — 本 change 均为对既有能力域的行为修复与补齐）

### Modified Capabilities

- `backend-java`: 鉴权要求共享密钥 + healthz 匿名放行；delete page/site 行为（级联 + 事务）；lead 去重冲突响应；新增 form DELETE（含 leads 占用校验）；导出与 testConnection 权限收紧
- `bff`: 登录速率限制；e2e 环境密钥注入；form DELETE 代理
- `engine`: 属性/样式/事件编辑可撤销且撤销栈页面隔离；datasource 错误可见；表单删除真实生效
- `ui`: 物料注册计数与 parity 一致；包名解析对外可用（scoped 导入）；代码高亮着色生效；BackToTop/CodeBlock 行为与 schema 一致
- `infra`: CI 必须真实阻断（无 continue-on-error/echo 兜底）；新增单测构建门禁；仓库清理（backend-go、stub、文档路径）

## Impact

- 代码：`apps/backend-java`（auth/service/controller/migration 测试）、`apps/bff`（auth/路由/compose）、`apps/engine`（PageEditor/PropertyPanel/useHistory/api/composables）、`packages/ui`（materials/import 路径/构建配置）
- CI：`.github/workflows/e2e-cross.yml` 重写 + 新 workflow
- **BREAKING**（内部）：Java 后端新增共享密钥校验，BFF/所有直连调用方需同步注入密钥头；`'luban-base'` 导入路径变更影响包内所有 material.ts 与 external 消费者
- 文档/任务图：CLAUDE.md、TODO.md、`docs/superpowers/tasks/*.json`、删除 `apps/backend-go/`
- 不涉及 apps/website（官网问题另行处理）
