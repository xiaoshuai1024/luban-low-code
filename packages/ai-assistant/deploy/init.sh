#!/usr/bin/env bash
# luban-ai-assistant 初始化脚本（幂等可重跑）
#
# 建库 / 建 Qdrant collection。已存在则跳过。
# 在 fastapi 容器或本地 venv 执行：bash deploy/init.sh
#
# 迁移说明（M0）：原 Milvus collection + MinIO bucket 段已替换为 Qdrant collection。
# 幂等性：每个步骤先检查存在性再创建，重复执行无副作用。

set -euo pipefail

echo "[init] luban-ai-assistant 资源初始化（幂等）"

# ===== PostgreSQL：建 ai_sessions 表 =====
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

# ===== Qdrant：建 luban_materials / luban_docs collection（幂等）=====
echo "[init] Qdrant: collections"
python - <<'PY'
import os
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, SparseVectorParams

HOST = os.environ.get("QDRANT_HOST", "qdrant")
PORT = int(os.environ.get("QDRANT_PORT", "6333"))
DENSE_DIM = 1024  # 与 embedding 维度对齐；collection 创建后维度不可改

client = QdrantClient(host=HOST, port=PORT)


def collection_exists(name: str) -> bool:
    """兼容不同 qdrant-client 版本的 collection 存在检查。"""
    if hasattr(client, "collection_exists"):
        return client.collection_exists(name)
    try:
        client.get_collection(name)
        return True
    except Exception:
        return False


# luban_materials：dense + sparse hybrid 检索（物料知识）
materials = "luban_materials"
if collection_exists(materials):
    print(f"[init] Qdrant collection '{materials}' 已存在，跳过")
else:
    client.create_collection(
        collection_name=materials,
        vectors_config={"dense": VectorParams(size=DENSE_DIM, distance=Distance.COSINE)},
        sparse_vectors_config={"sparse": SparseVectorParams()},
    )
    for field in ("name", "category", "site_id", "version"):
        client.create_payload_index(materials, field, field_schema="keyword")
    print(f"[init] Qdrant collection '{materials}' 已创建")

# luban_docs：dense + payload 过滤（产品文档/FAQ）
docs = "luban_docs"
if collection_exists(docs):
    print(f"[init] Qdrant collection '{docs}' 已存在，跳过")
else:
    client.create_collection(
        collection_name=docs,
        vectors_config={"dense": VectorParams(size=DENSE_DIM, distance=Distance.COSINE)},
    )
    for field in ("site_id", "type", "source"):
        client.create_payload_index(docs, field, field_schema="keyword")
    print(f"[init] Qdrant collection '{docs}' 已创建")
PY

echo "[init] 完成"
