# Prod 部署（Docker Compose + Traefik）

## 服务器目录

- 代码：`/opt/luban/prod/luban`（`git clone https://github.com/xiaoshuai1024/luban.git`）
- GHCR 只读 token（可选）：`deploy/environments/prod/secrets/ghcr_token`（权限 `600`）
- 运行时环境：`deploy/environments/prod/app.env`（从 `app.env.example` 复制后填写）

## 首次启动前

1. `cp deploy/environments/prod/app.env.example deploy/environments/prod/app.env`，填写 `ACME_EMAIL`、`MYSQL_*`、`REDIS_*`。
2. Docker 镜像加速（可选）：`daemon.json` 中配置 `registry-mirrors`（如 `https://docker.1ms.run`）。
3. 首次拉镜像前，各仓库 `master` 需至少跑一次 CI，使 `ghcr.io/xiaoshuai1024/*:master` 存在。

## 一键执行

在仓库根目录：

```bash
bash deploy/scripts/deploy-prod.sh
```

## 容器内端口（Traefik 转发目标）

- **manage（luban 前端）**：容器内 **4200**（nginx 监听 `4200`，与本地 `vite preview` 一致）。
- 对外仍只走 **80/443**（Traefik），浏览器不直接访问 4200。

## 域名与探活

| 服务 | Host | 探活 URL |
|------|------|----------|
| backend | `api.xiaoshuai1024.top` | `https://api.xiaoshuai1024.top/healthz`（重写至 `/backend/healthz`） |
| bff | `luban-bff.xiaoshuai1024.top` | `https://luban-bff.xiaoshuai1024.top/healthz` |
| website | `luban.xiaoshuai1024.top` | `https://luban.xiaoshuai1024.top/healthz` |
| manage | `manage.xiaoshuai1024.top` | `https://manage.xiaoshuai1024.top/healthz` |

## GitHub Secrets（`luban` 仓库）

- `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`
- 各仓库 `LUBAN_DEPLOY_APP_ID`、`LUBAN_DEPLOY_APP_PRIVATE_KEY`（GitHub App）

## 版本锁

`deploy/environments/prod/versions.env` 由 CI 在收到 `repository_dispatch` 后自动更新并提交。
