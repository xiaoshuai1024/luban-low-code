# Tasks: close-review-gaps

## 1. 生产配置入库（先收漂移）

- [x] 1.1 `.env.example` 移除明文 `SSH_PASS`，改注释说明 SSH key 方式；补 `INTERNAL_AUTH_SECRET`/`AUTH_JWT_SECRET` 条目
- [x] 1.2 将 10 个未提交修改文件 + 5 个 openspec 归档目录一次 commit（消息注明"生产配置与近期修复入库"），push feature 分支

## 2. Java 后端：安全

- [x] 2.1 AuthFilter 增加 `X-Internal-Auth` 共享密钥校验（env `INTERNAL_AUTH_SECRET`；未配置 fail-open + WARN；public/auth/healthz 路径跳过）
- [x] 2.2 Spring Security/过滤器链放行 `/backend/healthz` 匿名访问，返回 200
- [x] 2.3 LeadController export 与 DatasourceController testConnection 增加 admin 角色校验（403）
- [x] 2.4 单测：伪造头直连 401 / BFF 带密钥通过 / healthz 200 / 非 admin 403（两个端点）

## 3. Java 后端：删除与去重

- [x] 3.1 PageService.delete 事务化 + 级联删除 forms；表单含 leads 时返回 409 `PAGE_HAS_LEADS`（不再 500）
- [x] 3.2 SiteService 级联删除加 `@Transactional`
- [x] 3.3 LeadService.submit 捕获 `uk_form_dedup` 唯一键冲突，按去重策略返回（消除并发 500）
- [x] 3.4 新增 `DELETE /forms/{id}`：FormController `@DeleteMapping` + FormService.delete（含 leads → 409 `FORM_HAS_LEADS`）+ FormMapper.deleteById
- [x] 3.5 集成测试：删带表单页面 / 删站点原子性 / 并发重复提交 / form DELETE 204 与 409 分支
- [x] 3.6 H2 测试迁移目录与 `db/migration` 对齐（补缺的 2 个迁移，脱离废弃 schema.sql 兜底）

## 4. BFF

- [x] 4.1 backendClient 注入 `X-Internal-Auth` 头；apiHandler 剥离客户端传入的 `X-User-*`/`X-Internal-Auth` 头
- [x] 4.2 `auth/login` 与 `auth/api-key/login` 加按 IP 速率限制（内存窗口即可，超限 429）
- [x] 4.3 新增 `apps/bff/src/app/api/forms/[id]/route.ts` DELETE handler（透传 204/409/403）
- [x] 4.4 docker-compose.e2e.yml 注入 `AUTH_JWT_SECRET` 与 `INTERNAL_AUTH_SECRET`
- [x] 4.5 单测：登录限流 429 / DELETE 代理透传 / 内部头剥离

## 5. engine

- [x] 5.1 修复 usePageEditorApi.ts GBK 乱码 → UTF-8（内容语义不变），合并双份测试文件（`__tests__` 版为准）
- [x] 5.2 PropertyPanel props/style/events 改为 emit 变更（不直改 props.node），PageEditor 应用变更前 `history.push()`（撤销生效）
- [x] 5.3 `loadPage` 成功后调用 `history.reset()`（撤销栈页面隔离）
- [x] 5.4 PageEditor.loadDatasources 接入 `normalizeDatasourceError`（错误可见）
- [x] 5.5 api/form.ts 增加 `deleteForm`；FormList.handleDelete 真实调用并按 `FORM_HAS_LEADS` 409 分支提示
- [x] 5.6 Dashboard 页面数改真实 API 统计，移除 console.log 与 mock 注释
- [x] 5.7 单测更新：撤销时序（改后可撤销/undo 恢复旧值）、切页 reset、deleteForm API mock

## 6. UI 物料库

- [x] 6.1 material-parity.spec.ts 计数 34→39（实跑 `pnpm test` 全绿）
- [x] 6.2 全量替换 `'luban-base'` → `'@luban-low-code/luban-base'`（源码 + rollup external + vite alias + tsconfig paths），全仓 grep 断言零残留
- [x] 6.3 引入 highlight.js 主题 CSS（Markdown/CodeBlock 生效）
- [x] 6.4 BackToTop 实装 `duration` 滚动动画；CodeBlock maxHeight 区域改 `overflow-y: auto`
- [x] 6.5 materials/index.ts 陈旧注释计数修正（39）
- [x] 6.6 三包 build + test 验证（luban-base → luban-low-code → engine 消费链）

## 7. CI 门禁

- [x] 7.1 重写 e2e-cross.yml：去 `continue-on-error`/`|| echo`/`submodules: recursive`/`LUBAN_E2E_GO_API`
- [x] 7.2 新增 ci-test.yml：engine/bff/ui `pnpm test`+`build` 分 job + backend-java `mvn -q verify`（node 22 对齐）
- [ ] 7.3 push 后观察一次真实运行，确认失败可阻断（人为验证或核对 job 状态语义）

## 8. 工程对账与清理

- [x] 8.1 删除 `apps/backend-go/`；清理 Makefile、run-per-pkg.sh、push-all-commit-msg.lib.sh、scripts/README.md、`.claude` pr-backend-go 中的 Go 引用
- [x] 8.2 CLAUDE.md 项目表改为实际路径（apps/*、packages/*，收录 mcp/ai-assistant/sprint-mcp，移除不存在的 electron/cross-platform）
- [x] 8.3 任务图对账：e2e-coverage T24→done（完成后）、T22 还原真实 todo；luban-mcp-server 22 条→done；journey-registry DELETE covered 声明核实
- [x] 8.4 TODO.md 失效条目更新（Flutter 已实现、Go 放弃、BFF 已有测试）
- [x] 8.5 根目录 stub 脚本处理：verify-production.sh / flyway-squash-local.sh / scripts/feishu/* 删除或输出明确"未实现"提示
- [x] 8.6 归档 openspec 已完成的 luban-website-landing 与 docs-site-vitepress change
- [ ] 8.7 分栈验证收口：`make test-coverage` 汇总 + dev 栈（248）部署冒烟（鉴权/删除/form DELETE 链路）
  - 2026-08-15 部分完成：本地四栈测试全绿（engine 209 / bff 73 / ui 299 / java 101，build 全过）
  - ⛔ 已知债务（超出本 change 范围，如实记录）：
    1) 各包 vitest 未配 json-summary reporter、Java jacoco 未启用 → coverage-summary 实际值全为 `-`（该门禁因旧路径从未真正生效，本次修复路径后暴露）
    2) website 零测试（本 change 明确排除官网范围）
    3) journey 门禁 7 个 P0 旅程无 spec 绑定（存量注册表债务）
    4) dev 栈 248 部署冒烟待执行（需 SSH 部署 + INTERNAL_AUTH_SECRET 注入）

## 9. 收口

- [ ] 9.1 全部任务完成后 `/opsx:archive` 归档本 change（含 specs 同步）
- [x] 9.2 生成本 change 的 commit（按子系统分 commit，feature 分支 PR，禁止直推 master）
