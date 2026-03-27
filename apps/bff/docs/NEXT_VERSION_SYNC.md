# 下版本协同同步（BFF）

本文件用于 BFF 与后端、管理后台并行开发时的协同与防冲突。

## 当前对齐能力

- 新增公开页面正式路由：
  - `GET /api/public/sites/:slug/pages?path=:path`
- 兼容旧路由：
  - `GET /api/public/sites/:slug/pages/by-path?path=:path`
- 错误透传策略：
  - 将后端 `code/message/details/status` 原样透传给调用方

## 协同边界

- BFF 只做协议转换、鉴权透传与错误规整。
- 业务规则、状态约束、错误码语义以后端为准。
- 管理后台只依赖 BFF 路由，不直接请求 backend。
- 禁止直接推送 `master`，统一通过非 master 分支开发并提 PR 合并。

## 联调清单入口

- 管理后台侧联调文档：`luban/docs/NEXT_VERSION_INTEGRATION_CHECKLIST.md`

## Git 提交流程约束（避免 `unknown option trailer`）

- 问题现象：使用环境默认 `git` 提交时，可能报错 `unknown option 'trailer'`。
- 固定做法：提交和推送统一使用系统 Git：`/usr/bin/git`。
- 命令模板：
  - 查看状态：`/usr/bin/git status --short`
  - 提交：`/usr/bin/git commit -m "<message>"`
  - 推送：`/usr/bin/git push -u origin <branch>`
- 分支策略：禁止直接推送 `master`，统一通过非 `master` 分支开发并提 PR。
