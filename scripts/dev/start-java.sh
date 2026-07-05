#!/usr/bin/env bash
# 跨平台启动 luban Java 后端（Spring Boot）。
# - macOS / Linux：直接 `mvn -q spring-boot:run`，环境变量与 start-mvn.bat 对齐
# - Windows      ：委托给 start-mvn.bat（保留 Windows 路径与 `start /B` detached 行为）
#
# 与 packages/backend/luban-backend/start-mvn.bat 的环境变量保持一致（SSOT：本文件 + .bat）。
# 中间件在远端 dev 服务器（192.168.100.248），本机禁起 docker / 中间件（见 .agents/rules/luban-no-local-docker.md）。
set -euo pipefail

# 检测操作系统
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|*Windows*)
    # Windows：保留 .bat 行为（detached + 写 mvn-run.log）
    # 期望用户已通过 chocolatey / scoop / GnuWin32 安装 make（见 Makefile 顶部检测）
    if command -v cmd.exe >/dev/null 2>&1; then
      cmd.exe //c start-mvn.bat
      exit $?
    fi
    echo "❌ Windows 上未找到 cmd.exe。请检查 Git Bash / MSYS2 环境。" >&2
    exit 2
    ;;
esac

# macOS / Linux
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../../packages/backend/luban-backend" && pwd)"
cd "$BACKEND_DIR"

if [ ! -f start-mvn.bat ]; then
  echo "❌ 后端目录不存在或缺少 start-mvn.bat：$BACKEND_DIR" >&2
  exit 2
fi

# 远端中间件 env（与 start-mvn.bat 对齐；本机不起这些服务）
# 自动探测：内网 192.168.100.248 可达则走远端，否则 fallback 到本地 mysql/redis（brew 服务）
# 用户可通过显式 export MYSQL_HOST=... 等覆盖自动探测
REMOTE_MYSQL_HOST="192.168.100.248"
REMOTE_MYSQL_PORT="13306"
REMOTE_REDIS_HOST="192.168.100.248"
REMOTE_REDIS_PORT="16379"

detect_middleware() {
  local host="$1" port="$2"
  # 用 nc 探测，2s 超时；不可达则 fallback 本地
  if command -v nc >/dev/null 2>&1; then
    nc -z -w 2 "$host" "$port" 2>/dev/null && return 0
  elif [ -d "/Applications" ]; then
    # macOS 无 nc 时用 /dev/tcp（bash 内建）
    (echo > "/dev/tcp/$host/$port") 2>/dev/null && return 0
  fi
  return 1
}

if detect_middleware "$REMOTE_MYSQL_HOST" "$REMOTE_MYSQL_PORT"; then
  DEFAULT_MYSQL_HOST="$REMOTE_MYSQL_HOST"; DEFAULT_MYSQL_PORT="$REMOTE_MYSQL_PORT"; DEFAULT_MYSQL_PASSWORD="yanhuo123"
  DEFAULT_REDIS_HOST="$REMOTE_REDIS_HOST"; DEFAULT_REDIS_PORT="$REMOTE_REDIS_PORT"; DEFAULT_REDIS_PASSWORD=""
  MW_MODE="remote"
else
  echo "⚠ 远端中间件 $REMOTE_MYSQL_HOST:$REMOTE_MYSQL_PORT 不可达，fallback 到本地 mysql/redis" >&2
  echo "  （本地需 brew services start mysql redis；规则允许本地中间件，禁的是 docker）" >&2
  DEFAULT_MYSQL_HOST="127.0.0.1"; DEFAULT_MYSQL_PORT="3306"; DEFAULT_MYSQL_PASSWORD=""
  DEFAULT_REDIS_HOST="127.0.0.1"; DEFAULT_REDIS_PORT="6379"; DEFAULT_REDIS_PASSWORD=""
  MW_MODE="local"
fi

export APP_PORT="${APP_PORT:-8080}"
export MYSQL_HOST="${MYSQL_HOST:-$DEFAULT_MYSQL_HOST}"
export MYSQL_PORT="${MYSQL_PORT:-$DEFAULT_MYSQL_PORT}"
export MYSQL_DB="${MYSQL_DB:-luban}"
export MYSQL_USER="${MYSQL_USER:-root}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-$DEFAULT_MYSQL_PASSWORD}"
export REDIS_HOST="${REDIS_HOST:-$DEFAULT_REDIS_HOST}"
export REDIS_PORT="${REDIS_PORT:-$DEFAULT_REDIS_PORT}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-$DEFAULT_REDIS_PASSWORD}"

# 检测 mvn
if ! command -v mvn >/dev/null 2>&1; then
  echo "❌ 未找到 mvn。macOS 安装：brew install maven" >&2
  exit 127
fi

echo "→ 启动 luban Java 后端（mvn spring-boot:run）..."
echo "  middleware [$MW_MODE]: MySQL $MYSQL_HOST:$MYSQL_PORT / Redis $REDIS_HOST:$REDIS_PORT"
echo "  health: http://localhost:$APP_PORT/actuator/health  (~30-60s, Flyway 自动迁移)"
echo ""

# 前台运行（trap 由调用方 / make dev-apps 处理）
exec mvn -q spring-boot:run
