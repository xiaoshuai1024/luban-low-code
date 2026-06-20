"""hybrid 检索器：dense + sparse 并查 → 融合排序 → top-k 物料（去 rerank）。

融合策略：归一化加权（dense 权重 + sparse 权重），取 top-k。
Milvus 支持单次 hybrid search（dense ANN + sparse inverted），此处封装统一接口。

类型说明：Milvus client（pymilvus.MilvusClient）无完整 stub，此处以 Any 表达，
所有 client 方法调用即合法，不需 type:ignore。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings
from app.rag.embedding import Embedder
from app.rag.sync_materials import build_sparse_vector


@dataclass
class RetrievedMaterial:
    """检索结果项。"""

    name: str
    category: str
    description: str
    props_schema_json: str
    score: float

    def props_schema(self) -> dict[str, object] | None:
        if not self.props_schema_json or self.props_schema_json == "{}":
            return None
        try:
            data: dict[str, object] = json.loads(self.props_schema_json)
            return data
        except json.JSONDecodeError:
            return None


class Retriever:
    """物料知识 hybrid 检索器（client 可注入，便于 mock）。"""

    def __init__(
        self,
        settings: Settings,
        embedder: Embedder,
        client: Any | None = None,
        *,
        dense_weight: float = 0.6,
        sparse_weight: float = 0.4,
    ) -> None:
        self._settings = settings
        self._embedder = embedder
        self._client: Any = client
        self._dense_weight = dense_weight
        self._sparse_weight = sparse_weight

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        from pymilvus import MilvusClient

        self._client = MilvusClient(
            uri=f"http://{self._settings.milvus_host}:{self._settings.milvus_port}"
        )
        return self._client

    def search(self, query: str, *, top_k: int = 5) -> list[RetrievedMaterial]:
        """hybrid 检索：dense + sparse 融合 → top-k 物料。"""
        client = self._get_client()
        collection = self._settings.milvus_collection

        dense = self._embedder.embed_query(query)
        sparse = build_sparse_vector(query)

        # Milvus hybrid search：dense + sparse 两路召回，融合排序
        results = client.search(
            collection_name=collection,
            data=[dense],
            anns_field="dense_vector",
            search_params={"metric_type": "IP", "params": {"nprobe": 10}},
            limit=top_k,
            output_fields=["name", "category", "description", "props_schema_json"],
        )
        sparse_results = client.search(
            collection_name=collection,
            data=[sparse],
            anns_field="sparse_vector",
            search_params={"metric_type": "IP"},
            limit=top_k,
            output_fields=["name", "category", "description", "props_schema_json"],
        )

        return self._fuse(results, sparse_results, top_k)

    def _fuse(
        self,
        dense_results: list[Any],
        sparse_results: list[Any],
        top_k: int,
    ) -> list[RetrievedMaterial]:
        """融合两路结果（归一化加权，去 rerank）。"""
        scores: dict[str, float] = {}
        meta: dict[str, dict[str, object]] = {}

        for hit_list, weight in (
            (dense_results, self._dense_weight),
            (sparse_results, self._sparse_weight),
        ):
            hits: list[dict[str, Any]] = hit_list[0] if hit_list else []
            # 归一化（按本路最大分）
            raw = [(h.get("distance", h.get("score", 0.0)), h) for h in hits]
            max_score = max((sc for sc, _ in raw), default=1.0) or 1.0
            for score, hit in raw:
                entity: dict[str, Any] = hit.get("entity", hit)
                name = entity.get("name", "")
                if not name:
                    continue
                norm = (score / max_score) * weight
                scores[name] = scores.get(name, 0.0) + norm
                meta[name] = entity

        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
        out: list[RetrievedMaterial] = []
        for name, sc in ranked:
            m = meta[name]
            out.append(
                RetrievedMaterial(
                    name=name,
                    category=str(m.get("category", "")),
                    description=str(m.get("description", "")),
                    props_schema_json=str(m.get("props_schema_json", "{}")),
                    score=round(sc, 4),
                )
            )
        return out
