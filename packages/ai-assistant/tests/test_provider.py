"""M1 provider 层单测(LiteLLM 实现,全 mock,不依赖真实 API)。

覆盖:
- 三家 provider 实例化(model 名映射 LiteLLM provider 前缀)
- get_provider 按 MODEL_PROVIDER 返回对应类型 + 单例
- chat() 结构化输出(mock litellm.completion 返回 JSON)
- stream() 流式(mock litellm 的 chunk 流)
- LiteLLM model 名格式正确(deepseek/deepseek-chat 等)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import HumanMessage, SystemMessage
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
    )


# ===== 实例化:三家映射正确(model 名 + LiteLLM 前缀) =====


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
    # model 名映射正确
    assert {
        ModelProvider.GLM: s.glm_model,
        ModelProvider.DEEPSEEK: s.deepseek_model,
        ModelProvider.QWEN: s.qwen_model,
    }[provider] == p.name


def test_litellm_model_name_has_provider_prefix() -> None:
    """LiteLLM 用 provider/model 格式路由,三家前缀正确。"""
    s = _make_settings(ModelProvider.DEEPSEEK)
    assert DeepSeekProvider(s).litellm_model == "deepseek/deepseek-chat"

    s = _make_settings(ModelProvider.GLM)
    assert ZhipuProvider(s).litellm_model == "glm/glm-4"

    s = _make_settings(ModelProvider.QWEN)
    # qwen 走 OpenAI 兼容模式,用 openai/<model> + custom_llm_provider 或 dashscope
    assert QwenProvider(s).litellm_model.startswith(("qwen/", "dashscope/", "openai/"))


# ===== get_provider:按配置切换 + 单例 =====


def test_get_provider_singleton_per_provider_key() -> None:
    reset_provider_for_tests()
    s = _make_settings(ModelProvider.DEEPSEEK)
    p1 = get_provider(s)
    p2 = get_provider(s)
    assert p1 is p2  # 单例
    assert isinstance(p1, DeepSeekProvider)


def test_get_provider_switch_only_needs_config_change() -> None:
    """切换三家:仅改 MODEL_PROVIDER,不协同。"""
    reset_provider_for_tests()
    assert isinstance(get_provider(_make_settings(ModelProvider.GLM)), ZhipuProvider)
    reset_provider_for_tests()
    assert isinstance(get_provider(_make_settings(ModelProvider.DEEPSEEK)), DeepSeekProvider)
    reset_provider_for_tests()
    assert isinstance(get_provider(_make_settings(ModelProvider.QWEN)), QwenProvider)


def test_reset_provider_for_tests_clears_singleton() -> None:
    reset_provider_for_tests()
    p = get_provider(_make_settings(ModelProvider.GLM))
    reset_provider_for_tests()
    p2 = get_provider(_make_settings(ModelProvider.GLM))
    assert p is not p2


# ===== chat:mock litellm.completion 结构化输出 =====


def _fake_completion_response(content: str) -> MagicMock:
    """构造假的 litellm.completion 返回(choices[0].message.content = content)。"""
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    return resp


def test_chat_returns_structured_pydantic(monkeypatch: pytest.MonkeyPatch) -> None:
    """chat(messages, response_model) 经 LiteLLM + response_format 返回 Pydantic 对象。"""
    s = _make_settings(ModelProvider.DEEPSEEK)
    p = DeepSeekProvider(s)

    captured: dict[str, Any] = {}

    def fake_completion(*args: Any, **kwargs: Any) -> Any:
        captured.update(kwargs)
        # 返回符合 _Out schema 的 JSON 字符串
        return _fake_completion_response('{"title": "用户列表页"}')

    monkeypatch.setattr("app.llm.provider.completion", fake_completion)

    msgs = [HumanMessage(content="生成标题")]
    result = p.chat(msgs, _Out)

    assert isinstance(result, _Out)
    assert result.title == "用户列表页"
    # LiteLLM 收到正确参数
    assert captured["model"] == "deepseek/deepseek-chat"
    assert captured["api_key"] == "ds-k"
    # messages 被转成 OpenAI 格式(role/content dict)
    assert isinstance(captured["messages"], list)
    assert captured["messages"][0]["role"] == "user"
    # 结构化模式:response_format 带 schema
    assert "response_format" in captured


def test_chat_handles_llm_invalid_json_with_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM 返回非法 JSON 时,chat 重试后成功(应用层逼近合法)。"""
    s = _make_settings(ModelProvider.GLM)
    p = ZhipuProvider(s)

    calls = {"n": 0}

    def fake_completion(*args: Any, **kwargs: Any) -> Any:
        calls["n"] += 1
        if calls["n"] == 1:
            return _fake_completion_response("not valid json {")
        return _fake_completion_response('{"title": "重试成功"}')

    monkeypatch.setattr("app.llm.provider.completion", fake_completion)
    result = p.chat([HumanMessage(content="x")], _Out)
    assert result.title == "重试成功"
    assert calls["n"] >= 2  # 至少重试一次


# ===== stream:mock litellm chunk 流 =====


@pytest.mark.asyncio
async def test_stream_yields_token_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _make_settings(ModelProvider.GLM)
    p = ZhipuProvider(s)

    async def fake_astream(*args: Any, **kwargs: Any):
        for chunk_text in ["你", "好", "世界"]:
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta.content = chunk_text
            yield chunk

    monkeypatch.setattr("app.llm.provider.acompletion", fake_astream)
    out = [c async for c in p.stream([HumanMessage(content="hi")])]
    assert out == ["你", "好", "世界"]


def test_chat_preserves_system_and_human_roles(monkeypatch: pytest.MonkeyPatch) -> None:
    """messages 转换保留 system/human 角色顺序。"""
    s = _make_settings(ModelProvider.DEEPSEEK)
    p = DeepSeekProvider(s)
    captured: dict[str, Any] = {}

    def fake_completion(*args: Any, **kwargs: Any) -> Any:
        captured.update(kwargs)
        return _fake_completion_response('{"title": "x"}')

    monkeypatch.setattr("app.llm.provider.completion", fake_completion)
    p.chat(
        [SystemMessage(content="你是助手"), HumanMessage(content="hi")],
        _Out,
    )
    roles = [m["role"] for m in captured["messages"]]
    assert roles == ["system", "user"]
