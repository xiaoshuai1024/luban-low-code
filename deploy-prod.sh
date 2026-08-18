#!/usr/bin/env bash
# =====================================================================
# luban 共存部署（与 gudu 同机 49.232.3.201）。.env.prod 为唯一入口。
#
# 注意：该服务器到 GitHub 不通，故 deploy 模式为 **push-based**（本地打包
#       工作树 → scp → 远端解压 → build），不走 git clone。
#
# 用法：
#   bash deploy-prod.sh            # 默认：打包本地代码 push 到远端 build+up（不碰 gudu-nginx）
#   bash deploy-prod.sh local      # 在服务器本机 build+up（须代码已在 REMOTE_DIR）
#   bash deploy-prod.sh edge       # 装 luban.conf 到 gudu-nginx + nginx -t + reload（唯一动 live 边缘）
#
# 依赖：本地 sshpass（winget: xhcoding.sshpass-win32）。
# Windows：脚本自动把 C:\Windows\System32\OpenSSH 提到 PATH 前（sshpass-win32 不兼容 MSYS ssh）。
# =====================================================================
set -euo pipefail

# ---- Windows: 强制用 Windows ssh.exe ----
if [ -x "/c/Windows/System32/OpenSSH/ssh.exe" ]; then
  export PATH="/c/Windows/System32/OpenSSH:$PATH"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
MODE="${1:-deploy}"
set -a; . "${ENV_FILE}"; set +a

COMPOSE_REMOTE="COMPOSE_PARALLEL_LIMIT=1 docker compose -f docker-compose.prod.yml --env-file ${ENV_FILE}"
# COMPOSE_PARALLEL_LIMIT=1：串行构建，防多镜像并行 build 内存峰值 OOM 殃及同机 gudu
GUDU_NGINX_CONF_DIR="/root/gudu/nginx/conf.d"
REMOTE_DIR="${REMOTE_DIR:-/opt/luban/prod/luban-low-code}"
SSHO=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

# build 传输用的工作树（排除重型/无关目录）
TAR_PATHS=(pnpm-workspace.yaml package.json pnpm-lock.yaml docker-compose.prod.yml deploy apps/backend-java apps/bff apps/engine apps/website packages/ui)
TAR_EXCLUDES=(--exclude=node_modules --exclude=dist --exclude=target --exclude=.nx --exclude=coverage --exclude=cypress --exclude='*.log' --exclude=.git --exclude=storybook-static --exclude=_site --exclude=playwright-report --exclude=test-results --exclude=.cache)

# ============ edge 模式：装 luban.conf 到 gudu-nginx 并 reload ============
if [ "${MODE}" = "edge" ]; then
  : "${SSH_HOST:?edge 模式需要 SSH_*}"
  : "${SSH_USER:?}"; : "${SSH_PASS:?}"
  command -v sshpass >/dev/null 2>&1 || { echo "✗ 缺 sshpass"; exit 1; }
  export SSHPASS="${SSH_PASS}"; REMOTE="${SSH_USER}@${SSH_HOST}"
  echo "» [edge] scp deploy/luban.conf → ${REMOTE}:${GUDU_NGINX_CONF_DIR}/"
  sshpass -e scp "${SSHO[@]}" deploy/luban.conf "${REMOTE}:${GUDU_NGINX_CONF_DIR}/luban.conf"
  echo "» [edge] nginx -t 校验（不过则绝不 reload）..."
  sshpass -e ssh "${SSHO[@]}" "${REMOTE}" bash -s <<EDGE
    set -e
    if ! docker exec gudu-nginx nginx -t 2>&1; then
      echo "✗ nginx -t 失败！已写 luban.conf 但【未 reload】，gudu 不受影响。"
      echo "  修复后重跑 edge，或删 ${GUDU_NGINX_CONF_DIR}/luban.conf 还原。"; exit 1
    fi
    docker exec gudu-nginx nginx -s reload; echo "✓ edge 完成（优雅 reload，不停 gudu）。"
EDGE
  unset SSHPASS; exit 0
fi

# ============ local 模式：本机起 luban 栈 ============
if [ "${MODE}" = "local" ]; then
  echo "» [local] 本机构建并启动 luban 栈（自带 DB，内网，不碰 gudu）..."
  ${COMPOSE_REMOTE} up -d --build --remove-orphans
  # 容器重建后 IP 变化，gudu-nginx 需 reload 刷新 proxy_pass 解析（否则 502）
  if docker ps --format '{{.Names}}' | grep -q '^gudu-nginx$'; then
    docker exec gudu-nginx nginx -t && docker exec gudu-nginx nginx -s reload && echo "  ✓ gudu-nginx reloaded"
  fi
  echo "✓ 栈已起。接入公网入口：bash deploy-prod.sh edge"; exit 0
fi

# ============ deploy 模式（默认）：push-based（本地打包 → scp → 远端 build+up）============
: "${SSH_HOST:?需要 SSH_*（或用 local/edge 子命令）}"
: "${SSH_USER:?}"; : "${SSH_PASS:?}"
command -v sshpass >/dev/null 2>&1 || { echo "✗ 缺 sshpass"; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "✗ 缺 tar"; exit 1; }
export SSHPASS="${SSH_PASS}"; REMOTE="${SSH_USER}@${SSH_HOST}"

TGZ="$(mktemp -t luban-deploy.XXXXXX.tgz 2>/dev/null || mktemp).tgz"
trap 'rm -f "${TGZ}"' EXIT

echo "» [1/4] 本地打包工作树（排除 node_modules/dist/target 等）..."
tar -czf "${TGZ}" "${TAR_EXCLUDES[@]}" "${TAR_PATHS[@]}"
echo "    $(du -h "${TGZ}" | cut -f1) 打包完成"

echo "» [2/4] scp 代码包 + .env.prod 到远端..."
sshpass -e scp "${SSHO[@]}" "${TGZ}" "${REMOTE}:/tmp/luban-deploy.tgz"
sshpass -e scp "${SSHO[@]}" "${ENV_FILE}" "${REMOTE}:/tmp/luban-env.prod"

echo "» [3/4] 远端解压就位（rm 旧目录 → 重建）..."
sshpass -e ssh "${SSHO[@]}" -o ServerAliveInterval=30 "${REMOTE}" bash -s <<EXTRACT
  set -e
  rm -rf "${REMOTE_DIR}" && mkdir -p "${REMOTE_DIR}"
  tar -xzf /tmp/luban-deploy.tgz -C "${REMOTE_DIR}"
  mv /tmp/luban-env.prod "${REMOTE_DIR}/${ENV_FILE}"
  rm -f /tmp/luban-deploy.tgz
  echo "    就绪：${REMOTE_DIR}"
EXTRACT

echo "» [4/4] 远端串行 build + up（自带 DB，内网不抢 gudu 端口；首次 ~10-15min）..."
sshpass -e ssh "${SSHO[@]}" -o ServerAliveInterval=30 "${REMOTE}" \
  "cd ${REMOTE_DIR} && ${COMPOSE_REMOTE} up -d --build --remove-orphans"

echo "» [reload] 刷新 gudu-nginx（容器重建后 IP 变化，不 reload 会 502）..."
sshpass -e ssh "${SSHO[@]}" "${REMOTE}" 'bash -s' <<'RELOAD' || echo "  ⚠ gudu-nginx reload 失败（非 gudu 共存部署可忽略，不影响 luban 栈）"
  if docker ps --format '{{.Names}}' | grep -q '^gudu-nginx$'; then
    docker exec gudu-nginx nginx -t && docker exec gudu-nginx nginx -s reload && echo "  ✓ gudu-nginx reloaded"
  else
    echo "  (无 gudu-nginx，跳过)"
  fi
RELOAD

echo ""
echo "✓ luban 栈已起（未碰 gudu-nginx）。接入公网入口：bash deploy-prod.sh edge"
echo "  hosts 绑 ${SSH_HOST} 后访问 http://{luban,manage,api,luban-bff}.xiaoshuai1024.top"
unset SSHPASS
