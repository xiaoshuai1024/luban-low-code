"""云端 embedding 客户端(LiteLLM 实现,与 LLM 解耦,可独立配置 provider/model)。

M2 迁移:从 openai SDK 改为 LiteLLM embedding(统一 provider 前缀路由)。
支持 GLM/OpenAI/通义 embedding。单测用 mock,不依赖真实 API。
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


def get_embedder(settings: Settings) -> Embedder:
    """按配置构造 embedder(LiteLLM,默认 GLM provider 前缀,云端可配)。

    provider_prefix 按 embedding_provider 映射到 LiteLLM 路由前缀。
    """
    prefix_map = {"glm": "openai", "openai": "openai"}  # GLM 走 OpenAI 兼容协议
    prefix = prefix_map.get(settings.embedding_provider, "openai")
    key = settings.embedding_api_key.get_secret_value()
    emb: Embedder = _LiteLLMEmbedder(
        api_key=key,
        base_url=settings.embedding_base_url,
        model=settings.embedding_model,
        # GLM embedding-3 = 2048 维;此处用配置约定的 1024(与 init.sh collection schema 对齐)
        dim=1024,
        provider_prefix=prefix,
    )
    return emb
