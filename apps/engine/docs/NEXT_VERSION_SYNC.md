# 下版本协同同步（管理后台）

本文件用于管理后台与后端并行开发时的协同与防冲突。

## 协同边界

- 管理后台（`luban`）负责：
  - 页面列表与编辑交互
  - 用户管理交互与权限提示
  - 调用 BFF `/api/*` 接口
- 后端（`luban-backend`）负责：
  - 公开页面查询接口
  - 鉴权策略（`RequireUser` / `RequireAdmin` / public 白名单）
  - 领域约束与错误码

## 契约版本

- API 文档基线：`luban-backend/docs/API.md`
- 本轮新增约定：
  - `GET /api/public/sites/:slug/pages?path=:path`（BFF）
  - 对应后端：`GET /backend/public/sites/:slug/pages?path=:path`
  - 403 权限错误码：`PERMISSION_DENIED`

## 当前进度

- [x] 页面管理：已发布页面支持预览入口（优先使用站点 `baseUrl`）
- [x] 用户管理：403 时展示无权限提示并禁用新建操作
- [x] 公开接口：管理后台可通过 BFF 公共路径访问已发布页面

## 并行开发规则

- 与“下版本功能设计计划”相关的文档改动集中在 `docs/`，避免修改同一业务代码文件。
- 功能开发只改动本系统目录，不跨仓库直接复制代码。
- 任何接口字段调整先更新 `luban-backend/docs/API.md`，再同步前端调用。
- 禁止直接推送 `master`，统一在当前开发分支（如 `dev` 或 feature 分支）提交并通过 PR 合并。

## 联调清单入口

- 统一联调清单：`docs/NEXT_VERSION_INTEGRATION_CHECKLIST.md`

## Git 提交流程约束（避免 `unknown option trailer`）

- 问题现象：使用环境默认 `git` 提交时，可能报错 `unknown option 'trailer'`。
- 固定做法：提交和推送统一使用系统 Git：`/usr/bin/git`。
- 命令模板：
  - 查看状态：`/usr/bin/git status --short`
  - 提交：`/usr/bin/git commit -m "<message>"`
  - 推送：`/usr/bin/git push -u origin <branch>`
- 分支策略：禁止直接推送 `master`，统一在 `dev` 或 feature 分支提交并通过 PR 合并。
