#!/usr/bin/env bash
# 生产冒烟验证：4 子域 HTTPS 可达 + healthz + 公开 API 快速检查
# 用法：
#   bash scripts/verify-production.sh --mode=quick   # 仅可达性 + healthz
#   bash scripts/verify-production.sh --mode=full    # quick + 登录 + 认证 API 冒烟（需 PROD_USER/PROD_PASSWORD）
#   bash scripts/verify-production.sh --local ...    # 本地 dev 端口（127.0.0.1:3100/4200/3000/8080）
# 生产域名（与 deploy/luban.conf 保持一致）：
#   https://luban.xiaoshuai1024.top          website SSR
#   https://manage.xiaoshuai1024.top         engine 管理端
#   https://luban-bff.xiaoshuai1024.top      BFF
#   https://api.xiaoshuai1024.top            Java 后端（经 nginx 反代）
set -euo pipefail

MODE="quick"
LOCAL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode=quick|--mode=full) MODE="${1#--mode=}" ;;
    --local) LOCAL=1 ;;
    *) echo "未知参数: $1（支持 --mode=quick|full --local）"; exit 2 ;;
  esac
  shift
done

if [[ $LOCAL -eq 1 ]]; then
  WEBSITE="http://127.0.0.1:3000"
  ENGINE="http://127.0.0.1:4200"
  BFF="http://127.0.0.1:3100"
  API="http://127.0.0.1:8080"
else
  WEBSITE="https://luban.xiaoshuai1024.top"
  ENGINE="https://manage.xiaoshuai1024.top"
  BFF="https://luban-bff.xiaoshuai1024.top"
  API="https://api.xiaoshuai1024.top"
fi

PASS=0; FAIL=0
check() { # name url [expect_status]
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "✓ $name ($code)"; PASS=$((PASS+1))
  else
    echo "✗ $name — $url 返回 $code（期望 $expect）"; FAIL=$((FAIL+1))
  fi
}

echo "== luban 生产冒烟（mode=$MODE local=$LOCAL）=="
check "website 首页" "$WEBSITE/"
check "engine 管理端" "$ENGINE/"
check "BFF healthz" "$BFF/healthz"
check "backend healthz" "$API/backend/healthz"

if [[ "$MODE" == "full" ]]; then
  if [[ -z "${PROD_USER:-}" || -z "${PROD_PASSWORD:-}" ]]; then
    echo "!! full 模式需要 PROD_USER / PROD_PASSWORD 环境变量"; exit 2
  fi
  LOGIN_CODE=$(curl -s -o /tmp/luban-login.json -w '%{http_code}' --max-time 15 \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$PROD_USER\",\"password\":\"$PROD_PASSWORD\"}" \
    "$BFF/api/auth/login" || echo "000")
  if [[ "$LOGIN_CODE" == "200" ]]; then
    echo "✓ 登录 (200)"; PASS=$((PASS+1))
    TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/luban-login.json')).get('token') or json.load(open('/tmp/luban-login.json')).get('accessToken',''))" 2>/dev/null || true)
    if [[ -n "$TOKEN" ]]; then
      for ep in auth/me sites; do
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H "Authorization: Bearer $TOKEN" "$BFF/api/$ep" || echo "000")
        if [[ "$code" == "200" ]]; then echo "✓ GET /api/$ep ($code)"; PASS=$((PASS+1));
        else echo "✗ GET /api/$ep 返回 $code"; FAIL=$((FAIL+1)); fi
      done
    fi
    rm -f /tmp/luban-login.json
  else
    echo "✗ 登录失败 ($LOGIN_CODE)"; FAIL=$((FAIL+1))
  fi
fi

echo "== 结果: $PASS 通过 / $FAIL 失败 =="
[[ $FAIL -eq 0 ]] || exit 1
