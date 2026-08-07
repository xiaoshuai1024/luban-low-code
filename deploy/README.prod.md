# luban 生产部署指南（共存模式）

与 gudu 生产业务**同机**（`49.232.3.201`）共存部署。核心：**零 host 端口、自带 DB、内存硬隔离、复用 gudu-nginx 边缘**，确保不影响 gudu 现网。

## 架构

```
              gudu-nginx (既有, 占 80/443, gudu_default 网络)
                │  + luban.conf (4 子域 server 块, 独立文件)
        ┌───────┼───────────────┬──────────────┬─────────────┐
   luban.       manage.        api.          luban-bff.
   →luban-website:4173  →luban-manage:4200   →luban-backend:8080  →luban-bff:3000
   (Nuxt SSR)           (引擎,/api→luban-bff:3000)  (/healthz→/backend/healthz)

   luban 栈(自带 DB, 仅 luban_net 内网, 零 host 端口):
     luban-mysql:3306(内部)  luban-redis:6379(内部)
   每容器 mem_limit, 总上限 ~2.2G → OOM 只殃及 luban, 不碰 gudu
```

gudu 的 `gudxsd.top` / `gudu-mysql-prod` 等完全不受影响。

## 域名映射（经 gudu-nginx）

| 子域 | luban 容器 | 探活 |
|------|-----------|------|
| `luban.xiaoshuai1024.top` | luban-website:4173 | 首页 |
| `manage.xiaoshuai1024.top` | luban-manage:4200 | `/healthz` |
| `api.xiaoshuai1024.top` | luban-backend:8080 | `/healthz`→`/backend/healthz` |
| `luban-bff.xiaoshuai1024.top` | luban-bff:3000 | `/healthz` |

## 前置条件

1. 生产机 `49.232.3.201`：docker + git 已装（已确认），gudu 在跑（**不要动**）。
2. 内存余量 ~3.4G（已确认）；luban 硬限 ~2.2G，留 gudu 余量。
3. `.env.prod` 已填（SSH_*、MYSQL_*、REDIS_*、LEAD_ENC_KEY、AUTH_JWT_SECRET 等；密钥已生成）。
4. 本机已装 sshpass（`winget install xhcoding.sshpass-win32`）。

## 部署（两步分离，edge 是唯一动 live 边缘的步骤）

**第 1 步——起 luban 栈（不碰 gudu-nginx）：**
```bash
bash deploy-prod.sh            # SSH 远端 git pull + build + up（首次 ~10-15min）
```
验：`docker compose -f docker-compose.prod.yml ps`（远端）；容器健康、零 host 端口。

**第 2 步——接入 gudu-nginx 边缘（带 nginx -t 安全门）：**
```bash
bash deploy-prod.sh edge       # scp luban.conf → gudu-nginx conf.d；nginx -t 不过则绝不 reload
```
`nginx -t` 失败时脚本自动中止，gudu 现网不受影响。

## 本地验证（hosts 绑生产 IP，HTTP）

按 `deploy/hosts.template` 把四子域绑到 `49.232.3.201`，然后：
```bash
curl http://luban.xiaoshuai1024.top/            # website 首页
curl http://manage.xiaoshuai1024.top/healthz    # engine
curl http://api.xiaoshuai1024.top/healthz       # backend
curl http://luban-bff.xiaoshuai1024.top/healthz # bff
```
并 `docker stats` 确认 luban 内存不越界、gudu 容器无重启。

## TLS（后续，非本期）

初期 HTTP。正式访问需：
1. DNS 添加四子域 A 记录 → `49.232.3.201`；
2. 用既有 `gudu-certbot`（HTTP-01）或腾讯云 DNS-01（`.env.prod` `TENCENT_*`）签 luban 子域证书；
3. `luban.conf` 各 server 块补 `listen 443 ssl` + 证书路径，reload。

## 排障

- **edge 步骤 `nginx -t` 失败**：读报错修 `deploy/luban.conf`；gudu 未受影响；重跑 edge。
- **`docker compose up` 卡/慢**：首次 build 重，`docker stats` 看内存；串行构建，峰值单镜像。
- **engine `/api` 502**：`docker exec luban-manage nginx -T | grep proxy_pass` 应为 `http://bff:3000`（已从 3100 修复）。
- **website SSR 调 bff 超时**：临时把 `NUXT_PUBLIC_BFF_BASE_URL` 改 `http://luban-bff:3000`（仅 SSR）。

## 回滚（不影响 gudu）

```bash
# 摘掉 luban 公网入口
ssh root@49.232.3.201 'rm /root/gudu/nginx/conf.d/luban.conf && docker exec gudu-nginx nginx -s reload'
# 移除 luban 栈（自带 DB 卷保留）
bash deploy-prod.sh ... && docker compose -f docker-compose.prod.yml down
```
