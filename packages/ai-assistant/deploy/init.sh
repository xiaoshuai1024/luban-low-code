#!/usr/bin/env bash
# luban-ai-assistant 初始化脚本（幂等可重跑）
#
# 建库 / 建 Milvus collection / 建 MinIO bucket。已存在则跳过。
# 在 fastapi 容器或本地 venv 执行：bash deploy/init.sh
#
# 幂等性：每个步骤先检查存在性再创建，重复执行无副作用。

set -euo pipefail

echo "[init] luban-ai-assistant 资源初始化（幂等）"

# ===== PostgreSQL：建 ai_sessions 表 + langfuse schema（langfuse 自管，此处仅业务表）=====
echo "[init] PostgreSQL: ai_sessions 表"
python - <<'PY'
import asyncio, os
import asyncpg

async def main():
    dsn = os.environ.get("POSTGRES_DSN", "postgresql://luban:luban@postgres:5432/luban_ai")
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_sessions (
              id VARCHAR(36) PRIMARY KEY,
              user_id VARCHAR(36) NOT NULL,
              site_id VARCHAR(36),
              page_id VARCHAR(36),
              status VARCHAR(32) NOT NULL DEFAULT 'idle',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id)"
        )
        print("[init] ai_sessions 表就绪")
    finally:
        await conn.close()

asyncio.run(main())
PY

# ===== Milvus：建 luban_materials collection（hybrid: dense + sparse）=====
echo "[init] Milvus: ${MILVUS_COLLECTION:-luban_materials} collection"
python - <<'PY'
import os
from pymilvus import (
    MilvusClient,
    DataType,
    utility,
    connections,
)

COLLECTION = os.environ.get("MILVUS_COLLECTION", "luban_materials")
HOST = os.environ.get("MILVUS_HOST", "milvus")
PORT = os.environ.get("MILVUS_PORT", "19530")

connections.connect(host=HOST, port=int(PORT))
if utility.has_collection(COLLECTION):
    print(f"[init] Milvus collection '{COLLECTION}' 已存在，跳过")
else:
    client = MilvusClient(uri=f"http://{HOST}:{PORT}")
    schema = client.create_schema(auto_id=False, enable_dynamic_field=True)
    schema.add_field("pk", DataType.VARCHAR, is_primary=True, max_length=128)
    schema.add_field("name", DataType.VARCHAR, max_length=128)
    schema.add_field("category", DataType.VARCHAR, max_length=64)
    schema.add_field("description", DataType.VARCHAR, max_length=2048)
    schema.add_field("props_schema_json", DataType.VARCHAR, max_length=8192)
    schema.add_field("dense_vector", DataType.FLOAT_VECTOR, dim=1024)
    schema.add_field("sparse_vector", DataType.SPARSE_FLOAT_VECTOR)
    index_params = client.prepare_index_params()
    index_params.add_index(field_name="dense_vector", index_type="AUTOINDEX", metric_type="IP")
    index_params.add_index(field_name="sparse_vector", index_type="SPARSE_INVERTED_INDEX", metric_type="IP")
    client.create_collection(
        collection_name=COLLECTION, schema=schema, index_params=index_params
    )
    print(f"[init] Milvus collection '{COLLECTION}' 已创建")
PY

# ===== MinIO：建 ai-assets bucket（P2 图片用，P1 预建）=====
echo "[init] MinIO: ${MINIO_BUCKET:-ai-assets} bucket"
python - <<'PY'
import os
from minio import Minio

endpoint = os.environ.get("MINIO_ENDPOINT", "minio:9000")
access_key = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
secret_key = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
secure = os.environ.get("MINIO_SECURE", "false").lower() == "true"
bucket = os.environ.get("MINIO_BUCKET", "ai-assets")

client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
if client.bucket_exists(bucket):
    print(f"[init] MinIO bucket '{bucket}' 已存在，跳过")
else:
    client.make_bucket(bucket)
    print(f"[init] MinIO bucket '{bucket}' 已创建")
PY

echo "[init] 完成"
