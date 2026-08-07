# Tasks — unified-prod-deploy（共存模式）

> 服务器 49.232.3.201 与 gudu 生产业务同机；端口 80/443/3306/6379 已被 gudu 占用。
> 核心约束：**不影响 gudu 现有服务** → luban 零 host 端口、自带 DB、内存硬限、复用 gudu-nginx 边缘。

## 1. 统一 .env.prod 入口

- [x] 1.1 `.env.prod` 扩充为唯一 prod 入口：SSH_*、TENCENT_*、ACME_EMAIL、REMOTE_DIR/REPO_URL、MYSQL_*/REDIS_*（指向 luban 内网容器 mysql/redis）、LEAD_ENC_KEY、AUTH_JWT_SECRET、MYSQL_ROOT_PASSWORD。
- [x] 1.2 生成 luban 全新密钥（LEAD_ENC_KEY / AUTH_JWT_SECRET / MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD）并写入 `.env.prod`（sed 直写，值不进对话）。luban 在该机为全新部署，无既有密钥需对齐。

## 2. 共存编排（自带 DB + 内网 + 内存隔离）

- [x] 2.1 `docker-compose.prod.yml`：自带 mysql:8 + redis:7（仅 luban_net，零 host 端口）；backend/bff/website/manage 另挂外部 `gudu_default` 供 gudu-nginx 寻址；**去 Traefik**；每服务 `mem_limit` + Java `-Xmx512m`（总上限 ~2.2G，OOM 只殃及 luban）；`compose config` 通过。
- [x] 2.2 `deploy/luban.conf`：gudu-nginx 的 4 子域 server 块（独立文件，不碰 app-http.conf），HTTP + ACME webroot + WS 头；`nginx -t` 校验并入 edge 步骤。

## 3. 修复 engine→bff 端口

- [x] 3.1 `nginx-manage.conf`：`proxy_pass http://bff:3100 → http://bff:3000`（代码已改；容器内 `nginx -T`/`/api` 非 502 验证并入 4.2）。

## 4. 部署脚本 + 验证

- [x] 4.1 `deploy-prod.sh`：三模式 —— `deploy`(默认,SSH 起 luban 栈,不碰 gudu) / `local`(本机) / `edge`(装 luban.conf + `nginx -t` 安全门 + reload gudu-nginx)；修 sshpass+Windows ssh.exe PATH；`bash -n` 通过。`deploy/README.prod.md` + `hosts.template` 已更新为共存流程。
- [x] 4.2 部署 + edge + 端到端验证（已完成）：6 容器全起、Flyway 迁移 9 表、零 host 发布端口、gudu 仍 `Up 5 weeks` 未受影响；四域路由通——`manage`/`bff` healthz **200**、`website` 302→站点（正常）、`api/healthz` **401**（见 6.1）；内存余 2771MB。

## 5. 验收门禁

- [x] 5.1 本地静态：`docker compose ... config`（含真实 .env.prod）VALID；`deploy-prod.sh` `bash -n` 通过；未改 TS 源码故未跑 `pnpm build`。端到端 `/healthz` 验收并入 4.2（部署后）。

## 6. 实施中发现并处理的问题

- [x] 6.1 **服务器到 GitHub 不通**（国内腾讯云）→ `deploy-prod.sh` 改为 **push-based**（本地 tar → scp → 远端解压 → build），不再 git clone。
- [x] 6.2 **engine 镜像 build 失败**：`LubanCodeBlock`/`LubanMarkdown` 用 `highlight.js`/`markdown-it`，但 engine 以 `link:` 引 luban-low-code 不装其依赖闭包，node 解析走不到 engine 的 node_modules → 给 `apps/engine/package.json` 补这两个依赖 + `vite.config.ts` 加 alias（镜像 sortablejs 既有 workaround）；本地 vite build 验证通过、远端重建成功。
- [ ] 6.3 **backend `/backend/healthz` 返 401**（Spring Security 未放行）→ 容器显示 `unhealthy`（但 app 正常服务）。**后续**：backend `SecurityConfig` 放行 `/healthz`（或改用 actuator 并放行），让 healthz 返 200。属 backend 应用层，非本部署变更范围。
- [ ] 6.4 **改动未提交 git**：`nginx-manage.conf`/`engine/package.json`/`vite.config.ts`/`pnpm-lock.yaml` + 新增 `docker-compose.prod.yml`/`deploy-prod.sh`/`deploy/`。待用户确认后 commit（CLAUDE.md：仅在用户要求时提交）。
