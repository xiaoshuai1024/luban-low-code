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
DENSE_DIM = int(os.environ.get("EMBEDDING_DIM", "2048"))  # 与 embedding 维度对齐；collection 创建后维度不可改
FORCE_RECREATE = os.environ.get("QDRANT_FORCE_RECREATE", "") == "1"  # 维度变更时强制重建

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


def ensure_collection(name: str, sparse: bool, payload_index_fields: list[str]) -> None:
    """幂等建 collection（FORCE_RECREATE=1 时先删后建，用于维度变更）。"""
    if FORCE_RECREATE and collection_exists(name):
        client.delete_collection(collection_name=name)
        print(f"[init] Qdrant collection '{name}' 已删除（FORCE_RECREATE=1）")
    if collection_exists(name):
        print(f"[init] Qdrant collection '{name}' 已存在，跳过")
        return
    vectors_config = {"dense": VectorParams(size=DENSE_DIM, distance=Distance.COSINE)}
    kwargs = {}
    if sparse:
        kwargs["sparse_vectors_config"] = {"sparse": SparseVectorParams()}
    client.create_collection(collection_name=name, vectors_config=vectors_config, **kwargs)
    for field in payload_index_fields:
        client.create_payload_index(name, field, field_schema="keyword")
    print(f"[init] Qdrant collection '{name}' 已创建 (dim={DENSE_DIM})")


# luban_materials：dense + sparse hybrid 检索（物料知识）
ensure_collection(
    "luban_materials",
    sparse=True,
    payload_index_fields=["name", "category", "site_id", "version"],
)

# luban_docs：dense + payload 过滤（产品文档/FAQ）
ensure_collection(
    "luban_docs",
    sparse=False,
    payload_index_fields=["site_id", "type", "source"],
)
PY

echo "[init] 完成"
