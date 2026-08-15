#!/usr/bin/env bash
# =====================================================================
# 官网种子：把 default 站点 + / 主页（deploy/seed/default-homepage.json）
# 写入生产 luban_prod 库（status=published，website 公开端点即可渲染）。
#
# 幂等：先删旧 default 站点与其页面，再插入（重复执行安全）。
# 用 SQL 而非 BFF API：生产 users 表为空无法登录签 JWT（dogfood 可后续补）。
#
# 用法：bash deploy/seed/seed-default-site.sh   # 读 .env.prod 的 SSH_*
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
set -a; . "${ENV_FILE}"; set +a
: "${SSH_HOST:?需要 SSH_*（读 ${ENV_FILE}）}"
: "${SSH_USER:?}"; : "${SSH_PASS:?}"
command -v sshpass >/dev/null 2>&1 || { echo "✗ 缺 sshpass"; exit 1; }

export SSHPASS="${SSH_PASS}"
REMOTE="${SSH_USER}@${SSH_HOST}"
SSHO=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
JSON="deploy/seed/default-homepage.json"

echo "» [1/2] scp ${JSON} → 远端..."
sshpass -e scp "${SSHO[@]}" "$JSON" "$REMOTE:/tmp/default-homepage.json"

echo "» [2/2] 远端生成 SQL 并写入 luban_prod（幂等重建 default 站点）..."
sshpass -e ssh "${SSHO[@]}" "$REMOTE" 'bash -s' <<'SEED'
set -e
# 用 python 把 JSON 安全转义进 SQL（单引号双写），生成幂等种子脚本
python3 - <<'PY' > /tmp/seed-default-site.sql
import json

with open('/tmp/default-homepage.json', encoding='utf-8') as f:
    schema = json.load(f)

def sqlstr(obj):
    # ensure_ascii=False 保留中文；单引号双写转义
    return json.dumps(obj, ensure_ascii=False).replace("'", "''")

print("""-- luban 官网种子（幂等）：default 站点 + / 主页
DELETE p FROM pages p JOIN sites s ON p.site_id = s.id WHERE s.slug = 'default';
DELETE FROM sites WHERE slug = 'default';
SET @site_id = REPLACE(UUID(), '-', '');
INSERT INTO sites (id, name, slug, base_url, seo_json, analytics_json, status, created_at, updated_at)
VALUES (@site_id, 'Luban 官网', 'default', 'https://luban.xiaoshuai1024.top', NULL, NULL, 'active', NOW(3), NOW(3));
INSERT INTO pages (id, site_id, name, path, status, schema_json, seo_json, created_at, updated_at)
VALUES (REPLACE(UUID(), '-', ''), @site_id, '主页', '/', 'published',
        '{schema}', '{seo}', NOW(3), NOW(3));""".format(
    schema=sqlstr(schema),
    seo=sqlstr(schema.get('seo', {})),
))
PY

MP=$(docker exec luban-backend printenv MYSQL_PASSWORD)
DB=$(docker exec luban-backend printenv MYSQL_DB)
# 客户端必须显式 utf8mb4（容器内 mysql 客户端默认 latin1，中文会双重编码）
docker exec -i luban-mysql mysql --default-character-set=utf8mb4 -uluban -p"$MP" "$DB" < /tmp/seed-default-site.sql 2>&1 | grep -v 'Warning' || true
rm -f /tmp/seed-default-site.sql /tmp/default-homepage.json

# 校验
docker exec luban-mysql mysql --default-character-set=utf8mb4 -uluban -p"$MP" "$DB" -e \
  "SELECT s.slug, p.path, p.status, CHAR_LENGTH(p.schema_json) AS schema_len, HEX(LEFT(p.name,1)) AS name_hex FROM sites s JOIN pages p ON p.site_id=s.id WHERE s.slug='default';" 2>/dev/null
SEED
unset SSHPASS

echo "✓ 种子完成。验证：curl -sL https://luban.xiaoshuai1024.top/ 应渲染中文主页"
