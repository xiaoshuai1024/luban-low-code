"""P2-T1 多模态适配单测（plan P2）。

覆盖：
  - vision_model_name：按 MODEL_PROVIDER 返回三家视觉模型名
  - build_understanding_prompt：含可用物料清单
  - provider.chat_with_image：默认实现把图片注入 HumanMessage（mock provider）
"""

from __future__ import annotations

from typing import Any

from pydantic import SecretStr

from app.core.config import ModelProvider, Settings
from app.llm.multimodal import (
    DesignUnderstanding,
    build_understanding_prompt,
    vision_model_info,
    vision_model_name,
)
from app.llm.provider import Provider


def _settings(provider: ModelProvider) -> Settings:
    return Settings(
        environment="test",
        model_provider=provider,
        auth_jwt_secret=SecretStr("k"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
    )


def test_vision_model_name_per_provider() -> None:
    assert vision_model_name(_settings(ModelProvider.GLM)) == "glm-4v"
    assert vision_model_name(_settings(ModelProvider.DEEPSEEK)) == "deepseek-vl2"
    assert vision_model_name(_settings(ModelProvider.QWEN)) == "qwen-vl-plus"


def test_vision_model_info() -> None:
    info = vision_model_info(_settings(ModelProvider.GLM))
    assert info.provider == "glm"
    assert info.model == "glm-4v"


def test_build_understanding_prompt_contains_materials() -> None:
    lines = build_understanding_prompt(["LubanTable", "LubanForm"])
    text = "\n".join(lines)
    assert "LubanTable" in text
    assert "LubanForm" in text


def test_build_understanding_prompt_empty_materials() -> None:
    lines = build_understanding_prompt([])
    assert any("通用" in line for line in lines)


class _RecordingProvider(Provider):
    """记录 chat 调用的 mock provider，用于验证 chat_with_image 注入图片。"""

    def __init__(self) -> None:
        self.last_messages: list[Any] = []

    @property
    def name(self) -> str:
        return "mock-vlm"

    @property
    def provider_key(self) -> str:
        return "mock"

    def chat(self, messages: list[Any], response_model: type[Any]) -> Any:
        self.last_messages = messages
        # 返回一个最小 DesignUnderstanding
        return DesignUnderstanding(layout="测试", components=[], summary="s", title="t")

    def stream(self, messages: list[Any]) -> Any:  # pragma: no cover - 未用
        raise NotImplementedError

    def raw_model(self) -> Any:  # pragma: no cover - 未用
        raise NotImplementedError


def test_chat_with_image_injects_image_into_human_message() -> None:
    from langchain_core.messages import HumanMessage, SystemMessage

    provider = _RecordingProvider()
    # 默认 chat_with_image 走 Provider 基类实现
    result = provider.chat_with_image(
        [SystemMessage(content="sys"), HumanMessage(content="识别设计稿")],
        image_bytes=b"\x89PNG fake",
        image_mime="image/png",
        response_model=DesignUnderstanding,
    )
    assert isinstance(result, DesignUnderstanding)
    # 最后一条消息应是 HumanMessage 且 content 含 image_url
    last = provider.last_messages[-1]
    assert isinstance(last, HumanMessage)
    assert isinstance(last.content, list)
    img_part = [p for p in last.content if isinstance(p, dict) and p.get("type") == "image_url"]
    assert len(img_part) == 1
    assert img_part[0]["image_url"]["url"].startswith("data:image/png;base64,")
