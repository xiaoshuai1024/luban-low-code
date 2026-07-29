#!/usr/bin/env bash
# luban-ai-assistant 部署脚本（推到测试服务器）
#
# 🔒 安全：SSH 凭证（host/user/port/key/password）从仓库根 .env.dev 经 `source` 注入，
#    禁硬编码任何明文，禁入 git/日志/对话。.env.dev 已 .gitignore，不入仓。
#    CI 走 GitHub Secrets，不落盘明文。
#
# 用法（在仓库根）：
#   source .env.dev          # 注入 DEPLOY_SSH_HOST / DEPLOY_SSH_USER / DEPLOY_SSH_PORT / DEPLOY_SSH_KEY / DEPLOY_SSH_PASS
#   bash packages/ai/luban-ai-assistant/deploy/deploy.sh

set -euo pipefail

# ---- 0. 校验凭证已注入（值不为空，但不在脚本里打印/落盘）----
: "${DEPLOY_SSH_HOST:?需要在 .env.dev 中设置 DEPLOY_SSH_HOST}"
: "${DEPLOY_SSH_USER:?需要在 .env.dev 中设置 DEPLOY_SSH_USER}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/luban-ai-assistant}"

if [ -z "${DEPLOY_SSH_KEY:-}" ] && [ -z "${DEPLOY_SSH_PASS:-}" ]; then
  echo "ERROR: 需要在 .env.dev 中设置 DEPLOY_SSH_KEY 或 DEPLOY_SSH_PASS" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[deploy] 目标: ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:${DEPLOY_PORT} (密钥/口令从 .env.dev 注入，不打印)"

# ---- 1. 组装 SSH 选项（优先 key，回退 sshpass 口令）----
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$DEPLOY_SSH_PORT")
if [ -n "${DEPLOY_SSH_KEY:-}" ]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")
  SSH_BASE=(ssh "${SSH_OPTS[@]}")
  SCP_BASE=(scp "${SSH_OPTS[@]}")
else
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "ERROR: 口令模式需要 sshpass" >&2
    exit 1
  fi
  SSH_BASE=(sshpass -p "$DEPLOY_SSH_PASS" ssh "${SSH_OPTS[@]}")
  SCP_BASE=(sshpass -p "$DEPLOY_SSH_PASS" scp "${SSH_OPTS[@]}")
fi

# ---- 2. 远程建目录 ----
"${SSH_BASE[@]}" "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" \
  "mkdir -p ${DEPLOY_REMOTE_DIR}"

# ---- 3. 推送 compose + 服务（不含 .env / .git / __pycache__）----
echo "[deploy] rsync 推送服务文件..."
rsync -az --delete \
  --exclude='.env' --exclude='.env.*' --exclude='.git' \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='.venv' \
  -e "${SSH_BASE[*]}" \
  "${SERVICE_DIR}/" \
  "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:${DEPLOY_REMOTE_DIR}/"

# ---- 4. 远程：docker compose up + init（凭证经远程 .env 注入，本脚本不传明文）----
echo "[deploy] 远程 docker compose up --wait..."
"${SSH_BASE[@]}" "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" bash -lc "'
  set -e
  cd ${DEPLOY_REMOTE_DIR}
  test -f .env || { echo \"ERROR: 远程需先放置 .env（含真实 key）\"; exit 1; }
  docker compose config -q
  docker compose build
  docker compose up -d --wait
  docker compose exec -T fastapi bash deploy/init.sh
  echo \"[deploy] 远程健康检查:\"
  curl -fsS http://localhost:8000/healthz || { echo \"WARN: healthz 未就绪\"; exit 1; }
'"

echo "[deploy] 完成 → ${DEPLOY_SSH_HOST}:${DEPLOY_REMOTE_DIR}"
