## Context

侦察发现生产机 `49.232.3.201`（`VM-0-5-centos`，腾讯云，4C/7.7G/无 swap）**正运行 gudu 生产业务**：`gudu-nginx` 占 80/443、`gudu-mysql-prod` 占 3306、`gudu-redis-prod` 占 6379、`gudu-certbot` 跑 LE，共 15 个容器。luban 在该机为全新部署。原方案（Traefik 绑 80/443 + 连 host DB）会端口冲突并误连 gudu 库，故改为「共存模式」。动机见 `proposal.md - Why`，行为契约见 `specs/infra/spec.md`。

## Goals / Non-Goals

**Goals:**
- luban 与 gudu 同机共存，**零影响 gudu 现网**。
- luban 自带 DB、零 host 端口、内存硬隔离。
- 复用既有 gudu-nginx 作边缘，不引入第二个 80/443 进程。

**Non-Goals:**
- 不迁移/改动 gudu 任何容器与配置（仅向 gudu-nginx conf.d 增一个独立文件并 reload）。
- 不在本变更配真实 DNS / 申请 luban 证书（初期 HTTP，TLS 后续）。
- 不做 GHCR 镜像（远端 build from source）。

## Decisions

1. **零 host 端口 + 自带 DB**：luban 自带 mysql:8 / redis:7（仅 `luban_net` 内网），backend/bff/website/manage 另挂外部 `gudu_default` 供 gudu-nginx 寻址；不发布任何 host 端口。理由：80/443/3306/6379 全被 gudu 占用。替代：用非标端口独立 Traefik——URL 丑、仍抢内存，放弃。
2. **边缘复用 gudu-nginx**：新增独立 `deploy/luban.conf`（4 子域 server 块 → `luban-*` 容器），`scp` 到 `/root/gudu/nginx/conf.d/` 后 `docker exec gudu-nginx nginx -s reload`。理由：gudu-nginx 已是本机唯一 80/443 边缘，且 reload 优雅不停机。替代：替换为 Traefik 统管 gudu+luban——大迁移、高风险，放弃。
3. **内存硬隔离**：每服务 `mem_limit`（backend 900m + `-Xmx512m`、bff/website 256m、manage 96m、mysql 512m、redis 96m），总上限 ~2.2G。理由：宿主仅余 3.4G 且无 swap，cgroup 硬限确保 luban OOM 只殃及自己，不触发宿主 OOM killer 杀 gudu（尤其 gudu-mysql-prod）。
4. **入口分阶段**：初期 gudu-nginx HTTP（listen 80）；TLS 后续由既有 `gudu-certbot`（HTTP-01，需 DNS A 记录）或腾讯云 DNS-01（`.env.prod` `TENCENT_*`，无需 A 记录）签发，gudu-nginx 终结 HTTPS。理由：避免引入第二证书管理器；DNS 未配，先 HTTP 验证。
5. **engine→bff 端口修复**：`nginx-manage.conf` `proxy_pass http://bff:3100 → http://bff:3000`（BFF 实际端口），conf 烤入 manage 镜像，远端 build 生效。
6. **远端构建**：`deploy-prod.sh` 在生产机 `up --build`（build context 对齐 `apps/*`）；不依赖 GHCR。

## Risks / Trade-offs

- **构建期内存峰值**：首次 build 4 镜像（Java mvn / Node pnpm+nx）瞬时占内存 → 可能压力 gudu。缓解：docker 默认串行构建（峰值=单镜像）；`free` 显示 buff/cache 3.2G 可回收；部署时 `docker stats` 监控。
- **gudu-nginx reload 风险**：reload 本身优雅不停机，但若 `luban.conf` 语法错会致 reload 失败（gudu 仍跑旧配置，不影响）。缓解：edge 步骤先 `docker exec gudu-nginx nginx -t`，不过则绝不 reload。
- **内存无 swap**：突发负载下宿主仍可能紧张。缓解：luban 硬限 + 监控；必要时给 gudu 关键容器也设下限（后续）。
- **website SSR 调 bff 走公网域名**：`NUXT_PUBLIC_BFF_BASE_URL=https://luban-bff...`，SSR 经 gudu-nginx 回环；腾讯云一般支持 hairpin。失败可改内网 `http://luban-bff:3000`（仅 SSR）。

## Migration Plan

1. **本地校验**：`docker compose -f docker-compose.prod.yml --env-file .env.prod config`（已 VALID）。
2. **起 luban 栈（不碰 gudu）**：`bash deploy-prod.sh`（SSH 远端 build + up；零 host 端口）。
3. **接入边缘（唯一动 live 边缘，带 nginx -t 门）**：`bash deploy-prod.sh edge` → 装 luban.conf + 校验 + reload gudu-nginx。
4. **验证**：hosts 绑 `49.232.3.201`（见 `deploy/hosts.template`），`curl http://{四域}/healthz`；`docker stats` 看 luban 内存不越界、gudu 容器无重启。
5. **TLS（后续）**：DNS A 记录指向本机 → gudu-certbot HTTP-01，或用 `TENCENT_*` DNS-01。
- **回滚**：删 `luban.conf` + reload gudu-nginx；`docker compose down`（luban 栈整体移除，gudu 不受影响）。

## Open Questions

（侦察已答：服务器为 gudu 共享机、公网 IP、端口占用、资源余量均已查明。仅剩 TLS 签证方式 HTTP-01 vs DNS-01，DNS 配好后定，不阻塞初期 HTTP 部署。）
