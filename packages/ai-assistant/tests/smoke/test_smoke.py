"""三家模型冒烟测试（需真实 key，-m smoke 触发）。"""

from __future__ import annotations

import os

import pytest
from pydantic import BaseModel

from app.core.config import ModelProvider, Settings
from app.llm.adapters import get_provider, reset_provider_for_tests


class _Out(BaseModel):
    title: str


def _settings(provider: ModelProvider) -> Settings:
    """从环境读真实 key。缺 key 则 skip。"""
    key_map = {
        ModelProvider.GLM: "GLM_API_KEY",
        ModelProvider.DEEPSEEK: "DEEPSEEK_API_KEY",
        ModelProvider.QWEN: "QWEN_API_KEY",
    }
    key = os.environ.get(key_map[provider], "")
    if not key:
        pytest.skip(f"未配置 {key_map[provider]}，跳过 {provider.value} 冒烟")

    from pydantic import SecretStr

    return Settings(
        environment="test",
        model_provider=provider,
        auth_jwt_secret=SecretStr("smoke"),
        glm_api_key=SecretStr(os.environ.get("GLM_API_KEY", "")),
        deepseek_api_key=SecretStr(os.environ.get("DEEPSEEK_API_KEY", "")),
        qwen_api_key=SecretStr(os.environ.get("QWEN_API_KEY", "")),
        embedding_api_key=SecretStr(os.environ.get("GLM_API_KEY", "")),
    )


@pytest.mark.smoke
def test_glm_chat_structured() -> None:
    from langchain_core.messages import HumanMessage, SystemMessage

    s = _settings(ModelProvider.GLM)
    reset_provider_for_tests()
    p = get_provider(s)
    result = p.chat(
        [SystemMessage(content="输出一个含 title 字段的 JSON。"),
         HumanMessage(content="生成一个用户列表页的标题")],
        response_model=_Out,
    )
    assert isinstance(result, _Out)
    assert result.title


@pytest.mark.smoke
def test_deepseek_chat_structured() -> None:
    from langchain_core.messages import HumanMessage, SystemMessage

    s = _settings(ModelProvider.DEEPSEEK)
    reset_provider_for_tests()
    p = get_provider(s)
    result = p.chat(
        [SystemMessage(content="输出一个含 title 字段的 JSON。"),
         HumanMessage(content="生成一个用户列表页的标题")],
        response_model=_Out,
    )
    assert isinstance(result, _Out)
    assert result.title


@pytest.mark.smoke
def test_tongyi_chat_structured() -> None:
    from langchain_core.messages import HumanMessage, SystemMessage

    s = _settings(ModelProvider.QWEN)
    reset_provider_for_tests()
    p = get_provider(s)
    result = p.chat(
        [SystemMessage(content="输出一个含 title 字段的 JSON。"),
         HumanMessage(content="生成一个用户列表页的标题")],
        response_model=_Out,
    )
    assert isinstance(result, _Out)
    assert result.title
