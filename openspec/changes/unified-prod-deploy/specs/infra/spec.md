## ADDED Requirements

### Requirement: 单一生产配置入口

生产部署 SHALL 从仓库根的单个 `.env.prod` 读取全部传输与运行时配置（SSH 凭据、MySQL/Redis 连接、JWT/LEAD_ENC 密钥、ACME 等）。部署脚本 MUST NOT 依赖任何额外散落的环境文件（如 `apps/engine/deploy/environments/prod/app.env`）即可完成部署。

#### Scenario: 仅凭 .env.prod 完成部署

- **WHEN** 运维仅提供完整的根 `.env.prod`（且 `app.env` 不存在），执行 `deploy-prod.sh`
- **THEN** 部署成功完成，所有服务以 `.env.prod` 中的值启动

### Requirement: 边缘域名路由（复用既有 gudu-nginx，零 host 端口）

luban SHALL 不占用任何 host 端口（避免与同机 gudu 的 80/443/3306/6379 冲突）。边缘路由 SHALL 由既有 `gudu-nginx` 担任：新增独立 `luban.conf` 按 Host 将 `api.xiaoshuai1024.top`→backend（`/healthz` 重写至 `/backend/healthz`）、`luban-bff.xiaoshuai1024.top`→bff、`luban.xiaoshuai1024.top`→website、`manage.xiaoshuai1024.top`→engine。luban 公共服务 SHALL 挂到既有外部网络 `gudu_default` 以被 gudu-nginx 按容器名寻址；luban 自带 MySQL/Redis SHALL 仅在 luban 内网，MUST NOT 经公网或 host 端口暴露，MUST NOT 连接 gudu 的数据库。

#### Scenario: 各子域命中正确服务

- **WHEN** 请求分别到达四个已配置的 Host（经 gudu-nginx）
- **THEN** 各请求被路由到对应 luban 容器并返回该服务的响应

#### Scenario: 零 host 端口、不碰 gudu 库

- **WHEN** luban 栈启动
- **THEN** 无任何 luban 容器发布 host 端口；backend 连接的是 luban 自带 mysql/redis，而非 gudu 的 `gudu-mysql-prod`/`gudu-redis-prod`

### Requirement: 公网入口分阶段（先 HTTP，后 TLS）

luban 公网入口 SHALL 分阶段启用：初期经 gudu-nginx 以 HTTP（listen 80）提供访问（不干扰 gudu 既有 HTTPS）；TLS 证书 SHALL 后续由既有 `gudu-certbot`（HTTP-01，需 DNS A 记录指向本机）或腾讯云 DNS-01（`.env.prod` 的 `TENCENT_*`，无需 A 记录）签发，并复用 gudu-nginx 终结 HTTPS。MUST NOT 引入第二个占用 80/443 的边缘进程。

#### Scenario: 初期 HTTP 访问

- **WHEN** luban 栈启动且 `luban.conf` 已 reload 进 gudu-nginx（DNS 或 hosts 已指向本机）
- **THEN** 四子域经 `http://` 可达，gudu 的 `gudxsd.top` HTTPS 不受影响

#### Scenario: 后续 TLS 签发

- **WHEN** DNS A 记录指向本机（HTTP-01）或提供有效 `TENCENT_*`（DNS-01）
- **THEN** 四子域获得 LE 证书，gudu-nginx 以 HTTPS 终结 luban 流量

### Requirement: Engine 到 BFF 反代端口正确

引擎的 `/api` 反向代理 SHALL 转发到 BFF 实际监听端口。配置的代理目标端口 MUST 等于 BFF 容器的 `PORT`（当前为 `3000`）。

#### Scenario: 引擎 API 成功打到 BFF

- **WHEN** 引擎 SPA 经其 nginx 代理调用 `/api/*`
- **THEN** 请求到达 BFF 并返回有效响应（非 connection-refused / 502）

### Requirement: 本地 hosts 验证（HTTP）

部署后，运维 SHALL 将四个子域在本地 hosts 绑定到生产公网 IP（`49.232.3.201`），经 HTTP 验证 luban 各入口可达，无需正式 DNS 解析。

#### Scenario: hosts 绑定后四域可达

- **WHEN** 运维将四个子域在 hosts 绑定到 `49.232.3.201`，且 luban 栈 + `luban.conf` edge 步骤已完成
- **THEN** `http://luban.xiaoshuai1024.top`、`http://manage.xiaoshuai1024.top`、`http://api.xiaoshuai1024.top/healthz`、`http://luban-bff.xiaoshuai1024.top/healthz` 均有响应

### Requirement: 内存隔离（不殃及 gudu）

luban 每个容器 SHALL 设 `mem_limit`（backend 另以 `-Xmx512m` 限 JVM 堆），使 luban 总内存占用有硬上限（约 2.2G）。当 luban 容器内存超限，MUST 只影响 luban 自身（被 cgroup 限制/OOM），MUST NOT 触发宿主 OOM killer 杀害 gudu 容器（尤其 `gudu-mysql-prod`）。

#### Scenario: luban 内存越限不殃及 gudu

- **WHEN** luban backend 内存飙升超过其 `mem_limit`
- **THEN** 仅 luban 容器受影响（重启/被限），gudu 容器持续在运行、无重启
