"""LLM provider 适配层（运行期单一，仅改 MODEL_PROVIDER 切换）。

设计：
- Provider 抽象基类定义统一接口 chat(结构化)/stream(流式)。
- 三家适配器（智谱 GLM / DeepSeek / 通义 Qwen）均走 OpenAI 兼容协议
  （langchain_openai.ChatOpenAI + base_url/api_key），避免厂商专有 SDK 耦合。
- get_provider(settings) 按 MODEL_PROVIDER 返回单例（运行期不切换，防协同）。

测试：单测用 mock（respx / monkeypatch），不依赖真实 API；冒烟测试才用真实 key。
"""

from __future__ import annotations

import abc
from collections.abc import AsyncIterator
from threading import Lock

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage
from pydantic import BaseModel


class Provider(abc.ABC):
    """LLM provider 抽象。

    chat(): 结构化输出（instructor + Pydantic），用于生成须符合 schema 的对象。
    stream(): 原始 token 流，用于对话式流式回显。
    """

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """展示名（如 glm-4 / deepseek-chat / qwen-plus）。"""

    @property
    @abc.abstractmethod
    def provider_key(self) -> str:
        """provider 标识（glm/deepseek/tongyi）。"""

    @abc.abstractmethod
    def chat(
        self, messages: list[BaseMessage], response_model: type[BaseModel]
    ) -> BaseModel:
        """结构化输出：强制 LLM 返回符合 response_model 的对象。

        经 instructor 包装 ChatModel，应用层逼近合法（放弃 token 级约束解码）。
        """

    @abc.abstractmethod
    def stream(self, messages: list[BaseMessage]) -> AsyncIterator[str]:
        """流式输出原始 token 片段（yield str）。"""

    @abc.abstractmethod
    def raw_model(self) -> BaseChatModel:
        """底层 ChatModel（供 LangGraph/agent 直接编排）。"""


def _build_openai_chat(
    *, api_key: str, base_url: str, model: str, temperature: float = 0.2
) -> BaseChatModel:
    """三家统一走 OpenAI 兼容协议构造 ChatModel。"""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=temperature,
        # 结构化输出场景关闭随机性以逼近合法
        streaming=False,
    )


class _OpenAICompatProvider(Provider):
    """三家共用：OpenAI 兼容协议 + instructor 结构化输出 + 流式。"""

    def __init__(
        self,
        *,
        provider_key: str,
        api_key: str,
        base_url: str,
        model: str,
    ) -> None:
        self._provider_key = provider_key
        self._model_name = model
        self._api_key = api_key
        self._base_url = base_url
        self._chat: BaseChatModel | None = None
        self._instructor: object | None = None
        self._lock = Lock()

    @property
    def name(self) -> str:
        return self._model_name

    @property
    def provider_key(self) -> str:
        return self._provider_key

    def raw_model(self) -> BaseChatModel:
        """懒构造底层 ChatModel（避免 import 期建连）。"""
        if self._chat is None:
            with self._lock:
                if self._chat is None:
                    self._chat = _build_openai_chat(
                        api_key=self._api_key,
                        base_url=self._base_url,
                        model=self._model_name,
                    )
        return self._chat

    def _instructor_client(self) -> object:
        """instructor.wrap(ChatModel) —— 结构化输出（懒构造，带缓存）。"""
        if self._instructor is None:
            import instructor

            with self._lock:
                if self._instructor is None:
                    # instructor.from_openai / from_langchain —— 这里走 langchain adapter
                    self._instructor = instructor.from_langchain(self.raw_model())
        return self._instructor

    def chat(
        self, messages: list[BaseMessage], response_model: type[BaseModel]
    ) -> BaseModel:
        client = self._instructor_client()
        # instructor.from_langchain(...).create_partial(response_model, messages=...)
        # 返回 Pydantic 对象（instructor 重试逼近合法）。
        result = client.create_partial(  # type: ignore[attr-defined]
            response_model=response_model,
            messages=messages,
            max_retries=2,
        )
        return result  # type: ignore[no-any-return]

    async def stream(self, messages: list[BaseMessage]) -> AsyncIterator[str]:
        model = self.raw_model()
        async for chunk in model.astream(messages):
            # ChatModel chunk 是 AIMessageChunk，content 即文本片段
            content = chunk.content
            if isinstance(content, str) and content:
                yield content
