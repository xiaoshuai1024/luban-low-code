"""M2 RAG 单测(Qdrant client + embedder 全 mock,不依赖真实服务)。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import SecretStr

from app.core.config import Settings
from app.rag.retriever import RetrievedMaterial, Retriever
from app.rag.sync_materials import (
    MaterialDoc,
    MaterialSyncer,
    build_sparse_vector,
    tokenize,
)

# ===== 共用 fake =====


class FakeEmbedder:
    """确定性 fake embedder:按文本字符和生成向量(dim 任意,便于断言)。"""

    @property
    def dim(self) -> int:
        return 3

    def embed_query(self, text: str) -> list[float]:
        return self._vec(text)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    @staticmethod
    def _vec(text: str) -> list[float]:
        # 简单确定性映射:长度/字符和
        s = sum(ord(c) for c in text)
        return [float(len(text)), float(s % 100), float(s // 100 % 100)]


@dataclass
class _FakePoint:
    """模拟 Qdrant ScoredPoint(id/score/payload)。"""

    id: int
    score: float
    payload: dict[str, Any]


@dataclass
class _FakeQueryResponse:
    """模拟 Qdrant query_points 返回(.points)。"""

    points: list[_FakePoint]


class FakeQdrantClient:
    """内存 fake:模拟 Qdrant upsert/query_points/scroll/delete。"""

    def __init__(self) -> None:
        self.store: dict[int, dict] = {}  # qdrant_id → {vector, payload}
        self.upsert_calls = 0
        self.delete_calls = 0

    def upsert(self, *, collection_name: str, points: list) -> None:
        self.upsert_calls += 1
        for p in points:
            self.store[p.id] = {"vector": p.vector, "payload": p.payload}

    def query_points(self, *, collection_name: str, prefetch, query, using, limit, with_payload) -> _FakeQueryResponse:
        # fake:返回所有 point,按 dense 向量点积排序
        dense = query if isinstance(query, list) else []
        scored: list[_FakePoint] = []
        for pid, entry in self.store.items():
            vec = entry["vector"].get("dense", []) if isinstance(entry["vector"], dict) else []
            distance = sum(a * b for a, b in zip(dense, vec, strict=False))
            scored.append(_FakePoint(id=pid, score=distance, payload=dict(entry["payload"])))
        scored.sort(key=lambda p: p.score, reverse=True)
        return _FakeQueryResponse(points=scored[:limit])

    def scroll(self, *, collection_name: str, limit: int, offset=None, with_payload=True, with_vectors=False):
        items = list(self.store.items())
        if offset is not None:
            # 简化:offset 当起始索引
            items = items[offset:]
        batch = items[:limit]
        points = [_FakePoint(id=pid, score=0.0, payload=dict(entry["payload"])) for pid, entry in batch]
        next_offset = None
        return points, next_offset

    def delete(self, *, collection_name: str, points_selector) -> None:
        self.delete_calls += 1
        ids = points_selector if isinstance(points_selector, list) else []
        for pid in ids:
            self.store.pop(pid, None)


def _settings() -> Settings:
    return Settings(_env_file=None, 
        environment="test",
        auth_jwt_secret=SecretStr("jwt"),
        glm_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
    )


# ===== 分词 + 稀疏向量 =====


def test_tokenize_mixed_cn_en() -> None:
    toks = tokenize("LubanButton 按钮 submit")
    assert "lubanbutton" in toks
    assert "按钮" in [t for t in toks if not t.isascii()]
    assert "submit" in toks


def test_tokenize_drops_single_ascii_letter() -> None:
    assert "a" not in tokenize("a button")


def test_build_sparse_vector_accumulates_weights() -> None:
    sv = build_sparse_vector("table table form")
    idx = hash("table") % (2**31)
    # table 出现两次 → 权重 2.0
    assert sv[idx] == 2.0


# ===== 同步：幂等可重跑 =====


def _sample_materials() -> list[MaterialDoc]:
    return [
        MaterialDoc(
            name="LubanButton",
            category="form",
            description="按钮组件",
            props_schema={"type": "object", "properties": {"label": {"type": "string"}}},
        ),
        MaterialDoc(name="LubanTable", category="data", description="表格"),
    ]


def test_sync_upserts_all_materials() -> None:
    client = FakeQdrantClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    stat = syncer.sync(_sample_materials())
    assert stat == {"upserted": 2, "purged": 0}
    assert client.upsert_calls == 1
    assert len(client.store) == 2  # 2 个 qdrant_id
    # payload 含 name(物料名)
    names = {entry["payload"]["name"] for entry in client.store.values()}
    assert names == {"LubanButton", "LubanTable"}
    # dense + sparse 向量已写入
    sample = next(iter(client.store.values()))
    assert "dense" in sample["vector"]
    assert "sparse" in sample["vector"]


def test_sync_is_idempotent_on_rerun() -> None:
    client = FakeQdrantClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    mats = _sample_materials()
    syncer.sync(mats)
    syncer.sync(mats)  # 重跑(pk hash 稳定 → 同 id 覆盖,不新增)
    assert len(client.store) == 2
    assert client.upsert_calls == 2  # 调了两次 upsert


def test_sync_purge_missing() -> None:
    client = FakeQdrantClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    syncer.sync(_sample_materials())
    # 第二次只同步 LubanButton,purge_missing=True 应删 LubanTable
    stat = syncer.sync([_sample_materials()[0]], purge_missing=True)
    assert stat["purged"] == 1
    assert client.delete_calls == 1


def test_sync_empty_materials_noop() -> None:
    client = FakeQdrantClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    stat = syncer.sync([])
    assert stat == {"upserted": 0, "purged": 0}
    assert client.upsert_calls == 0


# ===== 检索:hybrid 融合 + top-k =====


def test_retriever_returns_topk_materials() -> None:
    client = FakeQdrantClient()
    settings = _settings()
    syncer = MaterialSyncer(settings, FakeEmbedder(), client=client)
    syncer.sync(_sample_materials())

    retriever = Retriever(settings, FakeEmbedder(), client=client)
    results = retriever.search("按钮组件", top_k=2)
    assert len(results) <= 2
    assert all(isinstance(r, RetrievedMaterial) for r in results)
    # 按分数降序
    scores = [r.score for r in results]
    assert scores == sorted(scores, reverse=True)


def test_retriever_names_are_known_materials() -> None:
    client = FakeQdrantClient()
    settings = _settings()
    syncer = MaterialSyncer(settings, FakeEmbedder(), client=client)
    syncer.sync(_sample_materials())

    retriever = Retriever(settings, FakeEmbedder(), client=client)
    results = retriever.search("表格", top_k=5)
    names = {r.name for r in results}
    assert names <= {"LubanButton", "LubanTable"}


def test_retrieved_material_parses_props_schema() -> None:
    m = RetrievedMaterial(
        name="X",
        category="c",
        description="d",
        props_schema_json='{"type": "object"}',
        score=0.5,
    )
    assert m.props_schema() == {"type": "object"}


def test_retrieved_material_empty_schema_returns_none() -> None:
    m = RetrievedMaterial("X", "", "", "{}", 0.1)
    assert m.props_schema() is None


# ===== embedding: get_embedder 按配置构造 =====


def test_get_embedder_returns_litellm_with_configured_dim() -> None:
    from app.rag.embedding import _LiteLLMEmbedder, get_embedder

    emb = get_embedder(_settings())
    assert isinstance(emb, _LiteLLMEmbedder)
    assert emb.dim == 1024
