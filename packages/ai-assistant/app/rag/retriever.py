"""hybrid 检索器:Qdrant dense + sparse 融合 → top-k 物料(去 rerank)。

M2 迁移:从 Milvus 改为 Qdrant。
- 检索:Qdrant query_points(dense + sparse prefetch + RRF Fusion)一步完成
- 融合:服务端 RRF;客户端 _fuse 作为降级/测试路径保留(归一化加权)
- client 可注入(测试用 in-memory 或 fake)

类型说明:Qdrant client(qdrant_client.QdrantClient)有 stub 但部分模型动态,
关键方法以显式类型标注,内部 Any 仅用于返回值解析。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings
from app.rag.embedding import Embedder
from app.rag.sync_materials import _ensure_no_proxy, build_sparse_vector


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
    """物料知识 hybrid 检索器(Qdrant,client 可注入,便于 mock)。"""

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
        # Qdrant client 构造:确保不走系统代理
        # (macOS 系统代理会拦截 localhost 请求致 502;生产环境无此问题)
        _ensure_no_proxy(self._settings.qdrant_host)
        from qdrant_client import QdrantClient

        self._client = QdrantClient(
            host=self._settings.qdrant_host,
            port=self._settings.qdrant_port,
            prefer_grpc=False,
            https=False,
        )
        return self._client

    def search(self, query: str, *, top_k: int = 5) -> list[RetrievedMaterial]:
        """hybrid 检索:dense + sparse 融合 → top-k 物料。

        优先用 Qdrant query_points(dense + sparse prefetch + RRF Fusion)一步完成;
        若 client 不支持 query_points(老版本/fake),降级到客户端 _fuse 两路融合。
        """
        client = self._get_client()
        collection = self._settings.qdrant_collection

        dense = self._embedder.embed_query(query)
        sparse = build_sparse_vector(query)

        # 路径 1:Qdrant query_points hybrid(服务端 RRF 融合,推荐)
        if hasattr(client, "query_points"):
            try:
                from qdrant_client.models import Prefetch, SparseVector

                sparse_vec = SparseVector(indices=list(sparse.keys()), values=list(sparse.values()))
                # qdrant-client 1.18: prefetch 须用 Prefetch 模型对象;多路时服务端默认 RRF 融合
                response = client.query_points(
                    collection_name=collection,
                    prefetch=[
                        Prefetch(query=dense, using="dense", limit=top_k * 3),
                        Prefetch(query=sparse_vec, using="sparse", limit=top_k * 3),
                    ],
                    query=dense,  # 最终用 dense 重排
                    using="dense",
                    limit=top_k,
                    with_payload=True,
                )
                return self._format_qdrant_points(response.points, top_k)
            except Exception:
                # 降级到路径 2(可能是 fake client 或老 API)
                pass

        # 路径 2:分两路 search + 客户端 _fuse(降级/fake client)
        dense_results = self._search_single(client, collection, "dense", dense, top_k)
        sparse_results = self._search_single(client, collection, "sparse", sparse, top_k)
        return self._fuse(dense_results, sparse_results, top_k)

    def _search_single(
        self,
        client: Any,
        collection: str,
        vector_name: str,
        vector: Any,
        top_k: int,
    ) -> list[dict[str, Any]]:
        """单路 search(降级路径用)。返回标准化 hit 列表。"""
        try:
            results = client.search(
                collection_name=collection,
                query_vector=(vector_name, vector) if isinstance(vector, list) else vector,
                limit=top_k,
                with_payload=True,
            )
            out: list[dict[str, Any]] = []
            for point in results or []:
                payload = getattr(point, "payload", None) or point.get("payload", {})
                out.append(
                    {
                        "distance": getattr(point, "score", None) or point.get("score", 0.0),
                        "entity": payload,
                    }
                )
            return out
        except Exception:
            return []

    def _format_qdrant_points(self, points: Any, top_k: int) -> list[RetrievedMaterial]:
        """Qdrant query_points 返回 → RetrievedMaterial 列表。"""
        out: list[RetrievedMaterial] = []
        for point in points or []:
            payload = getattr(point, "payload", None) or {}
            name = payload.get("name", "")
            if not name:
                continue
            out.append(
                RetrievedMaterial(
                    name=name,
                    category=str(payload.get("category", "")),
                    description=str(payload.get("description", "")),
                    props_schema_json=str(payload.get("props_schema_json", "{}")),
                    score=round(float(getattr(point, "score", 0.0)), 4),
                )
            )
        return out[:top_k]

    def _fuse(
        self,
        dense_results: list[Any],
        sparse_results: list[Any],
        top_k: int,
    ) -> list[RetrievedMaterial]:
        """融合两路结果(归一化加权,降级路径用)。"""
        scores: dict[str, float] = {}
        meta: dict[str, dict[str, object]] = {}

        for hit_list, weight in (
            (dense_results, self._dense_weight),
            (sparse_results, self._sparse_weight),
        ):
            hits: list[dict[str, Any]] = hit_list if isinstance(hit_list, list) else []
            # 归一化(按本路最大分)
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
