## Why

生产部署配置碎片化且与目标机现实脱节：根 `.env.prod` 仅含 SSH 凭据、运行时配置散落他处；侦察发现目标机 `49.232.3.201` **正运行 gudu 生产业务**（占满 80/443/3306/6379，仅余 3.4G 内存、无 swap）。原 Traefik 绑 80/443 + 连 host DB 的方案会端口冲突并误连 gudu 库。需以「共存 + 不影响 gudu」的方式统一部署，并修复引擎 nginx 反代 `bff:3100`（实际 3000）的端口错配。

## What Changes

- **统一 prod 入口**：根 `.env.prod` 升级为唯一 prod 配置（SSH + 运行时 + 生成的新密钥）。
- **共存编排**：新增 `docker-compose.prod.yml`——luban 自带 MySQL+Redis（仅内网）、**零 host 端口**、去 Traefik、每容器 `mem_limit`（总上限 ~2.2G）。
- **复用 gudu-nginx 边缘**：新增 `deploy/luban.conf`（4 子域 → luban 容器），独立文件 + `nginx -s reload`，不碰既有 `app-http.conf`。
- **部署脚本**：`deploy-prod.sh` 三模式（`deploy` 起 luban 栈 / `edge` 接入 gudu-nginx 带 `nginx -t` 安全门 / `local`）；修 sshpass+Windows ssh.exe 兼容。
- **修复 engine→bff 端口**：`nginx-manage.conf` `3100 → 3000`。
- **入口分阶段**：初期 HTTP，TLS 后续由 gudu-certbot/DNS-01。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `infra`: 新增「共存部署（零 host 端口 + 自带 DB + 内存隔离 + 复用 gudu-nginx 边缘）」与「公网入口分阶段」的行为要求。

## Impact

- **配置**：`.env.prod`、`docker-compose.prod.yml`、`deploy-prod.sh`、`deploy/luban.conf`、`deploy/hosts.template`、`deploy/README.prod.md`、`nginx-manage.conf`(端口)。
- **系统**：生产机 `49.232.3.201`（gudu 共享）、gudu-nginx（仅增 conf + reload）、luban 自带 DB（内网）。
- **不涉及**：gudu 任何容器/配置；应用业务代码。

### Acceptance Criteria

1. luban 栈启动后**零 host 端口**，backend 连的是 luban 自带 mysql/redis（非 gudu 库）。
2. `bash deploy-prod.sh edge` 经 `nginx -t` 校验后 reload gudu-nginx；hosts 绑 `49.232.3.201` 后 `http://{luban,manage,api,luban-bff}.xiaoshuai1024.top` 均可达、`/healthz` 200。
3. gudu 现网（`gudxsd.top`、gudu-mysql-prod 等）无重启/无影响。
4. luban 任一容器内存超限只 OOM 自己，不触发宿主 OOM killer 杀 gudu 容器。
5. `deploy-prod.sh` 仅凭 `.env.prod` 完成部署。
