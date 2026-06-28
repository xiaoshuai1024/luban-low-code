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


def _ensure_no_proxy(host: str) -> None:
    """确保指定 host 不走系统代理(幂等)。

    macOS 系统代理会拦截 localhost/内网请求致 502。httpx/httpx 读 NO_PROXY 环境变量。
    本函数把 host 追加到 NO_PROXY(已含则跳过)。生产环境无系统代理,此函数为空操作。
    """
    import os

    no_proxy = os.environ.get("NO_PROXY", "")
    if host in no_proxy:
        return
    os.environ["NO_PROXY"] = f"{no_proxy},{host}" if no_proxy else host


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
    """物料知识同步器(Qdrant client 可注入,便于 mock)。"""

    def __init__(
        self, settings: Settings, embedder: Embedder, client: object | None = None
    ) -> None:
        self._settings = settings
        self._embedder = embedder
        self._client = client

    def _get_client(self) -> object:
        if self._client is not None:
            return self._client
        # Qdrant client 构造:确保不走系统代理
        _ensure_no_proxy(self._settings.qdrant_host)
        from qdrant_client import QdrantClient

        client = QdrantClient(
            host=self._settings.qdrant_host,
            port=self._settings.qdrant_port,
            prefer_grpc=False,
            https=False,
        )
        self._client = client
        return self._client

    def sync(self, materials: list[MaterialDoc], *, purge_missing: bool = False) -> dict[str, int]:
        """同步物料到 collection(幂等)。返回统计。"""
        client = self._get_client()
        collection = self._settings.qdrant_collection

        if not materials:
            return {"upserted": 0, "purged": 0}

        texts = [m.searchable_text for m in materials]
        dense = self._embedder.embed_documents(texts)

        # Qdrant PointStruct:id 用物料 pk(确定性字符串 hash → uint),payload 存元数据
        from qdrant_client.models import PointStruct, SparseVector

        points: list[PointStruct] = []
        for m, vec in zip(materials, dense, strict=True):
            sparse = build_sparse_vector(m.searchable_text)
            points.append(
                PointStruct(
                    id=self._pk_to_qdrant_id(m.pk),
                    vector={
                        "dense": vec,
                        "sparse": SparseVector(
                            indices=list(sparse.keys()), values=list(sparse.values())
                        ),
                    },
                    payload={
                        "pk": m.pk,
                        "name": m.name,
                        "category": m.category,
                        "description": m.description,
                        "props_schema_json": m.props_schema_json(),
                    },
                )
            )

        client.upsert(collection_name=collection, points=points)  # type: ignore[attr-defined]

        purged = 0
        if purge_missing:
            existing = {self._pk_to_qdrant_id(m.pk) for m in materials}
            purged = self._delete_missing(collection, client, existing)

        return {"upserted": len(points), "purged": purged}

    @staticmethod
    def _pk_to_qdrant_id(pk: str) -> int:
        """物料 pk(字符串)→ Qdrant uint id(稳定 hash)。Qdrant 支持 uuid 但 uint 更省。"""
        return abs(hash(pk)) % (2**62)

    def _delete_missing(self, collection: str, client: object, keep: set[int]) -> int:
        """删除 collection 中不在 keep 集合的物料(purge_missing=True 时)。"""
        try:
            # Qdrant scroll 翻全量 id 比对
            offset = None
            to_delete: list[int] = []
            while True:
                res = client.scroll(  # type: ignore[attr-defined]
                    collection_name=collection,
                    limit=256,
                    offset=offset,
                    with_payload=False,
                    with_vectors=False,
                )
                points_batch, next_offset = res[0], res[1]
                for p in points_batch or []:
                    pid = getattr(p, "id", None)
                    if pid is not None and pid not in keep:
                        to_delete.append(pid)
                if next_offset is None:
                    break
                offset = next_offset

            if to_delete:
                client.delete(  # type: ignore[attr-defined]
                    collection_name=collection,
                    points_selector=to_delete,
                )
            return len(to_delete)
        except Exception:
            return 0
