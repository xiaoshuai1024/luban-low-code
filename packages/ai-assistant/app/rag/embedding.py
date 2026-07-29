"""embedding 客户端(支持云端 LiteLLM 或本地 sentence-transformers,与 LLM 解耦)。

M2 迁移:从 openai SDK 改为 LiteLLM embedding(统一 provider 前缀路由)。
支持 GLM/OpenAI/通义 embedding 及本地 sentence-transformers 加载。
单测用 mock,不依赖真实 API。
"""

from __future__ import annotations

from typing import Protocol

from app.core.config import Settings


class Embedder(Protocol):
    """embedding 抽象(供 retriever/sync 注入,可 mock)。"""

    @property
    def dim(self) -> int:
        """向量维度(Qdrant collection schema 须一致)。"""
        ...

    def embed_query(self, text: str) -> list[float]:
        """单条文本 → dense 向量。"""
        ...

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """批量文本 → dense 向量列表。"""
        ...


class _LiteLLMEmbedder:
    """LiteLLM embedding 实现(provider/model 前缀路由,与 LLM 层一致)。"""

    def __init__(self, *, api_key: str, base_url: str, model: str, dim: int, provider_prefix: str) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self._dim = dim
        self._provider_prefix = provider_prefix

    @property
    def dim(self) -> int:
        return self._dim

    @property
    def _litellm_model(self) -> str:
        """LiteLLM 路由 model 名(provider/model 前缀)。"""
        return f"{self._provider_prefix}/{self._model}"

    def embed_query(self, text: str) -> list[float]:
        from litellm import embedding

        resp = embedding(
            model=self._litellm_model,
            input=text,
            api_key=self._api_key,
            api_base=self._base_url,
        )
        return list(resp.data[0]["embedding"])

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        from litellm import embedding

        resp = embedding(
            model=self._litellm_model,
            input=texts,
            api_key=self._api_key,
            api_base=self._base_url,
        )
        return [list(d["embedding"]) for d in resp.data]


class _SentenceTransformersEmbedder:
    """本地 sentence-transformers embedding(bge-small-zh-v1.5,免外网)。

    模型文件经 volume 挂载,首次加载 15-30s(CPU 推理)。
    """

    def __init__(self, model_path: str) -> None:
        self._model_path = model_path
        self._model: object
        self._dim: int

    @property
    def dim(self) -> int:
        return self._dim

    def _ensure_loaded(self) -> None:
        if hasattr(self, "_model"):
            return
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self._model_path)
        self._dim = self._model.get_sentence_embedding_dimension()

    def embed_query(self, text: str) -> list[float]:
        self._ensure_loaded()
        model: object = self._model
        vec = model.encode(text, normalize_embeddings=True)  # type: ignore[union-attr]
        return list(vec)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        self._ensure_loaded()
        model: object = self._model
        vecs = model.encode(texts, normalize_embeddings=True)  # type: ignore[union-attr]
        return [list(v) for v in vecs]


def get_embedder(settings: Settings) -> Embedder:
    """按配置构造 embedder。

    路由:
      - embedding_provider=local: sentence-transformers 本地模型(bge-small-zh,512 维)
      - embedding_provider=openai/glm: LiteLLM 云端 API

    dim 由配置决定(须与 Qdrant collection 维度对齐):
      - bge-small-zh-v1.5(本地): 512
      - GLM embedding-3(云端): 2048
    """
    if settings.embedding_provider == "local":
        # 本地 sentence-transformers,模型路径由 EMBEDDING_MODEL 指定
        return _SentenceTransformersEmbedder(model_path=settings.embedding_model)

    prefix_map = {"glm": "openai", "openai": "openai"}  # GLM 走 OpenAI 兼容协议
    prefix = prefix_map.get(settings.embedding_provider, "openai")
    key = settings.embedding_api_key.get_secret_value()
    return _LiteLLMEmbedder(
        api_key=key,
        base_url=settings.embedding_base_url,
        model=settings.embedding_model,
        dim=settings.embedding_dim,
        provider_prefix=prefix,
    )
