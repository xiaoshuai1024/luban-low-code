"""P1-T2 provider 适配层单测（全 mock，不依赖真实 LLM API）。

覆盖：
- 三家 provider 实例化（base_url/key/model 正确映射）
- get_provider 按 MODEL_PROVIDER 返回对应类型，且单例
- 切换仅改配置（不同 provider 值 → 不同类）
- stream() 产出 token 片段（mock ChatModel）
- chat() 结构化输出（mock instructor 返回 Pydantic）
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessageChunk, BaseMessage, HumanMessage
from pydantic import BaseModel, SecretStr

from app.core.config import ModelProvider, Settings
from app.llm.adapters import (
    DeepSeekProvider,
    QwenProvider,
    ZhipuProvider,
    get_provider,
    reset_provider_for_tests,
)


class _Out(BaseModel):
    title: str


def _make_settings(provider: ModelProvider) -> Settings:
    return Settings(
        environment="test",
        model_provider=provider,
        auth_jwt_secret=SecretStr("jwt"),
        glm_api_key=SecretStr("glm-k"),
        deepseek_api_key=SecretStr("ds-k"),
        qwen_api_key=SecretStr("qw-k"),
        embedding_api_key=SecretStr("emb-k"),
        langfuse_public_key=SecretStr("pk"),
        langfuse_secret_key=SecretStr("sk"),
    )


# ===== 实例化：三家映射正确 =====


@pytest.mark.parametrize(
    ("provider", "cls"),
    [
        (ModelProvider.GLM, ZhipuProvider),
        (ModelProvider.DEEPSEEK, DeepSeekProvider),
        (ModelProvider.QWEN, QwenProvider),
    ],
)
def test_adapter_config_mapping(provider: ModelProvider, cls: type) -> None:
    s = _make_settings(provider)
    p = cls(s)
    assert p.provider_key == provider.value
    # 各家 model 名正确
    assert {
        ModelProvider.GLM: s.glm_model,
        ModelProvider.DEEPSEEK: s.deepseek_model,
        ModelProvider.QWEN: s.qwen_model,
    }[provider] == p.name


def test_glm_adapter_uses_glm_endpoint() -> None:
    s = _make_settings(ModelProvider.GLM)
    p = ZhipuProvider(s)
    assert p._base_url == s.glm_base_url
    assert p._api_key == "glm-k"


# ===== get_provider：按配置切换 + 单例 =====


def test_get_provider_returns_glm_by_default() -> None:
    reset_provider_for_tests()
    p = get_provider(_make_settings(ModelProvider.GLM))
    assert isinstance(p, ZhipuProvider)
    assert p.provider_key == "glm"


def test_get_provider_singleton_per_provider_key() -> None:
    reset_provider_for_tests()
    s = _make_settings(ModelProvider.DEEPSEEK)
    p1 = get_provider(s)
    p2 = get_provider(s)
    assert p1 is p2  # 单例
    assert isinstance(p1, DeepSeekProvider)


def test_get_provider_switch_only_needs_config_change() -> None:
    """切换三家：仅改 MODEL_PROVIDER，不协同。"""
    reset_provider_for_tests()
    assert isinstance(get_provider(_make_settings(ModelProvider.GLM)), ZhipuProvider)
    reset_provider_for_tests()
    assert isinstance(
        get_provider(_make_settings(ModelProvider.DEEPSEEK)), DeepSeekProvider
    )
    reset_provider_for_tests()
    assert isinstance(get_provider(_make_settings(ModelProvider.QWEN)), QwenProvider)


# ===== stream：mock ChatModel =====


class _FakeChatModel:
    """假 ChatModel：astream 产出预设片段。"""

    def __init__(self, chunks: list[str]) -> None:
        self._chunks = chunks

    async def astream(self, messages: list[BaseMessage]):
        for c in self._chunks:
            yield AIMessageChunk(content=c)


@pytest.mark.asyncio
async def test_stream_yields_token_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _make_settings(ModelProvider.GLM)
    p = ZhipuProvider(s)
    monkeypatch.setattr(
        p, "raw_model", lambda: _FakeChatModel(["你", "好", "世界"])
    )
    out = [c async for c in p.stream([HumanMessage(content="hi")])]
    assert out == ["你", "好", "世界"]


# ===== chat：mock instructor =====


class _FakeInstructor:
    def __init__(self, payload: object) -> None:
        self._payload = payload
        self.captured: dict[str, object] = {}

    def create_partial(
        self, *, response_model: type, messages: list, max_retries: int
    ) -> object:
        self.captured = {
            "response_model": response_model,
            "messages": messages,
            "max_retries": max_retries,
        }
        return self._payload


def test_chat_returns_structured_pydantic(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _make_settings(ModelProvider.DEEPSEEK)
    p = DeepSeekProvider(s)
    fake = _FakeInstructor(_Out(title="用户列表页"))
    monkeypatch.setattr(p, "_instructor_client", lambda: fake)

    msgs = [HumanMessage(content="生成标题")]
    result = p.chat(msgs, _Out)

    assert isinstance(result, _Out)
    assert result.title == "用户列表页"
    # instructor 收到正确的结构化参数
    assert fake.captured["response_model"] is _Out
    assert fake.captured["messages"] is msgs
    assert fake.captured["max_retries"] == 2


def test_reset_provider_for_tests_clears_singleton() -> None:
    reset_provider_for_tests()
    p = get_provider(_make_settings(ModelProvider.GLM))
    reset_provider_for_tests()
    p2 = get_provider(_make_settings(ModelProvider.GLM))
    assert p is not p2  # 重置后非同一实例
