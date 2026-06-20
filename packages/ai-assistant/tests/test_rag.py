"""P1-T4 RAG 单测（embedder + Milvus client 全 mock，不依赖真实服务）。"""

from __future__ import annotations

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
    """确定性 fake embedder：按文本字符和生成 3 维向量（dim=3 便于断言）。"""

    @property
    def dim(self) -> int:
        return 3

    def embed_query(self, text: str) -> list[float]:
        return self._vec(text)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    @staticmethod
    def _vec(text: str) -> list[float]:
        # 简单确定性映射：长度/字符和
        s = sum(ord(c) for c in text)
        return [float(len(text)), float(s % 100), float(s // 100 % 100)]


class FakeMilvusClient:
    """内存 fake：模拟 upsert/query/search/delete。"""

    def __init__(self) -> None:
        self.store: dict[str, dict] = {}  # pk → row
        self.upsert_calls = 0
        self.delete_calls = 0

    def upsert(self, *, collection_name: str, data: list[dict]) -> None:
        self.upsert_calls += 1
        for row in data:
            self.store[row["pk"]] = row

    def query(self, *, collection_name: str, output_fields: list, limit: int):
        return [
            {"pk": pk, **{f: row.get(f) for f in output_fields}} for pk, row in self.store.items()
        ][:limit]

    def delete(self, *, collection_name: str, filter: str) -> None:
        self.delete_calls += 1

    def search(self, *, collection_name, data, anns_field, search_params, limit, output_fields):
        # fake：返回与 store 中物料数等量的命中，distance 按 dense 字段模值
        field = anns_field
        hits = []
        for _pk, row in self.store.items():
            vec = row.get(field, [])
            distance = sum(vec) if vec else 0.0
            hits.append(
                {
                    "distance": distance,
                    "entity": {
                        "name": row.get("name"),
                        "category": row.get("category"),
                        "description": row.get("description"),
                        "props_schema_json": row.get("props_schema_json", "{}"),
                    },
                }
            )
        hits.sort(key=lambda h: h["distance"], reverse=True)
        return [hits[:limit]]


def _settings() -> Settings:
    return Settings(
        environment="test",
        auth_jwt_secret=SecretStr("jwt"),
        glm_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
        langfuse_public_key=SecretStr("k"),
        langfuse_secret_key=SecretStr("k"),
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
    client = FakeMilvusClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    stat = syncer.sync(_sample_materials())
    assert stat == {"upserted": 2, "purged": 0}
    assert client.upsert_calls == 1
    assert set(client.store) == {"LubanButton", "LubanTable"}
    # dense + sparse 向量已写入
    assert "dense_vector" in client.store["LubanButton"]
    assert "sparse_vector" in client.store["LubanButton"]


def test_sync_is_idempotent_on_rerun() -> None:
    client = FakeMilvusClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    mats = _sample_materials()
    syncer.sync(mats)
    syncer.sync(mats)  # 重跑
    # 仍只有 2 个物料（pk 覆盖，不新增）
    assert len(client.store) == 2
    assert client.upsert_calls == 2  # 调了两次 upsert


def test_sync_purge_missing() -> None:
    client = FakeMilvusClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    syncer.sync(_sample_materials())
    # 第二次只同步 LubanButton，purge_missing=True 应删 LubanTable
    stat = syncer.sync([_sample_materials()[0]], purge_missing=True)
    assert stat["purged"] == 1
    assert client.delete_calls == 1


def test_sync_empty_materials_noop() -> None:
    client = FakeMilvusClient()
    syncer = MaterialSyncer(_settings(), FakeEmbedder(), client=client)
    stat = syncer.sync([])
    assert stat == {"upserted": 0, "purged": 0}
    assert client.upsert_calls == 0


# ===== 检索：hybrid 融合 + top-k =====


def test_retriever_returns_topk_materials() -> None:
    client = FakeMilvusClient()
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
    client = FakeMilvusClient()
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


def test_get_embedder_returns_compat_with_configured_dim() -> None:
    from app.rag.embedding import _OpenAICompatEmbedder, get_embedder

    emb = get_embedder(_settings())
    assert isinstance(emb, _OpenAICompatEmbedder)
    assert emb.dim == 1024
