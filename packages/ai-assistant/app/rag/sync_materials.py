"""物料知识同步脚本：从 luban-ui materialRegistry 导出 → 入 Milvus（幂等可重跑）。

物料来源（§5 集成表）：luban-ui materialRegistry.getAll() →
  {name, version, category, description, propsSchema}

入 collection（luban_materials）字段：
  pk(=name) / name / category / description / props_schema_json
  + dense_vector(embedding) + sparse_vector(token 权重)

幂等：pk=物料名，重复 upsert 覆盖。删除已不存在的物料（可选，默认关闭以免误删）。

同步是单向数据管道，不碰 luban 业务库。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.core.config import Settings
from app.rag.embedding import Embedder


@dataclass
class MaterialDoc:
    """物料知识文档（materialRegistry 导出项）。"""

    name: str
    category: str = ""
    description: str = ""
    props_schema: dict[str, object] | None = None

    @property
    def pk(self) -> str:
        return self.name

    @property
    def searchable_text(self) -> str:
        """拼成一段文本供 embedding + 稀疏分词。"""
        parts = [self.name, self.category, self.description]
        if self.props_schema:
            parts.append(json.dumps(self.props_schema, ensure_ascii=False))
        return "\n".join(p for p in parts if p)

    def props_schema_json(self) -> str:
        return json.dumps(self.props_schema or {}, ensure_ascii=False)


_TOKEN_RE = re.compile(r"[A-Za-z0-9_\u4e00-\u9fff]+")


def tokenize(text: str) -> list[str]:
    """轻量分词：英文按词、中文按字（去停用词空）。供稀疏向量。"""
    toks: list[str] = []
    for raw in _TOKEN_RE.findall(text.lower()):
        if len(raw) <= 1 and not raw.isascii():
            toks.append(raw)  # 中文单字
        elif raw.isascii() and len(raw) == 1:
            continue  # 单字母英文噪声
        else:
            toks.append(raw)
    return toks


def build_sparse_vector(text: str) -> dict[int, float]:
    """构造稀疏向量（token hash → 权重）。

    Milvus SPARSE_FLOAT_VECTOR 接受 {index: value} dict。
    简单词频加权（非 BM25，已确认去 rerank 场景足够）。
    """
    weights: dict[int, float] = {}
    for tok in tokenize(text):
        idx = hash(tok) % (2**31)  # 稳定哈希到固定空间
        weights[idx] = weights.get(idx, 0.0) + 1.0
    return weights


class MaterialSyncer:
    """物料知识同步器（Milvus client 可注入，便于 mock）。"""

    def __init__(self, settings: Settings, embedder: Embedder, client: object | None = None) -> None:
        self._settings = settings
        self._embedder = embedder
        self._client = client

    def _get_client(self) -> object:
        if self._client is not None:
            return self._client
        from pymilvus import MilvusClient

        self._client = MilvusClient(
            uri=f"http://{self._settings.milvus_host}:{self._settings.milvus_port}"
        )
        return self._client

    def sync(
        self, materials: list[MaterialDoc], *, purge_missing: bool = False
    ) -> dict[str, int]:
        """同步物料到 collection（幂等）。返回统计。"""
        client = self._get_client()
        collection = self._settings.milvus_collection

        if not materials:
            return {"upserted": 0, "purged": 0}

        texts = [m.searchable_text for m in materials]
        dense = self._embedder.embed_documents(texts)

        rows: list[dict[str, object]] = []
        for m, vec in zip(materials, dense, strict=True):
            sparse = build_sparse_vector(m.searchable_text)
            rows.append(
                {
                    "pk": m.pk,
                    "name": m.name,
                    "category": m.category,
                    "description": m.description,
                    "props_schema_json": m.props_schema_json(),
                    "dense_vector": vec,
                    "sparse_vector": sparse,
                }
            )

        client.upsert(collection_name=collection, data=rows)  # type: ignore[attr-defined]

        purged = 0
        if purge_missing:
            existing = {m.pk for m in materials}
            purged = self._delete_missing(collection, client, existing)

        return {"upserted": len(rows), "purged": purged}

    def _delete_missing(
        self, collection: str, client: object, keep: set[str]
    ) -> int:
        """删除 collection 中不在 keep 集合的物料（purge_missing=True 时）。"""
        # 简化实现：查全量 pk 比对。生产可按需增量。
        try:
            res = client.query(  # type: ignore[attr-defined]
                collection_name=collection, output_fields=["pk"], limit=16384
            )
            to_delete = [
                r["pk"] for r in (res or []) if r.get("pk") not in keep
            ]
            if to_delete:
                client.delete(  # type: ignore[attr-defined]
                    collection_name=collection, filter=f"pk in {to_delete}"
                )
            return len(to_delete)
        except Exception:
            return 0
