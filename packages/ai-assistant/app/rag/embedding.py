"""云端 embedding 客户端（与 LLM 解耦，可独立配置 provider/model）。

支持 GLM/OpenAI 兼容协议。单测用 mock，不依赖真实 API。
"""

from __future__ import annotations

from typing import Protocol

from app.core.config import Settings


class Embedder(Protocol):
    """embedding 抽象（供 retriever/sync 注入，可 mock）。"""

    @property
    def dim(self) -> int:
        """向量维度（Milvus collection schema 须一致）。"""
        ...

    def embed_query(self, text: str) -> list[float]:
        """单条文本 → dense 向量。"""
        ...

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """批量文本 → dense 向量列表。"""
        ...


class _OpenAICompatEmbedder:
    """OpenAI 兼容协议 embedding（GLM/OpenAI/通义 embedding 均兼容）。"""

    def __init__(
        self, *, api_key: str, base_url: str, model: str, dim: int
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self._dim = dim
        self._client: object | None = None

    @property
    def dim(self) -> int:
        return self._dim

    def _get_client(self) -> object:
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(api_key=self._api_key, base_url=self._base_url)
        return self._client

    def embed_query(self, text: str) -> list[float]:
        client = self._get_client()
        resp = client.embeddings.create(input=text, model=self._model)  # type: ignore[attr-defined]
        return list(resp.data[0].embedding)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        client = self._get_client()
        resp = client.embeddings.create(input=texts, model=self._model)  # type: ignore[attr-defined]
        return [list(d.embedding) for d in resp.data]


def get_embedder(settings: Settings) -> Embedder:
    """按配置构造 embedder（GLM 默认，云端可配）。"""
    key = settings.embedding_api_key.get_secret_value()
    emb: Embedder = _OpenAICompatEmbedder(
        api_key=key,
        base_url=settings.embedding_base_url,
        model=settings.embedding_model,
        # GLM embedding-3 = 2048 维；此处用配置约定的 1024（与 init.sh collection schema 对齐）
        dim=1024,
    )
    return emb
