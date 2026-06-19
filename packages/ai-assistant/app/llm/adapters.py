"""三家 provider 具体适配器 + 工厂。

均走 OpenAI 兼容协议（见 provider._OpenAICompatProvider），仅 base_url/key/model 不同。
"""

from __future__ import annotations

from collections.abc import Callable

from app.core.config import ModelProvider, Settings
from app.llm.provider import Provider, _OpenAICompatProvider


class ZhipuProvider(_OpenAICompatProvider):
    """智谱 GLM-4（OpenAI 兼容协议）。"""

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            provider_key="glm",
            api_key=settings.glm_api_key.get_secret_value(),
            base_url=settings.glm_base_url,
            model=settings.glm_model,
        )


class DeepSeekProvider(_OpenAICompatProvider):
    """DeepSeek（原生 OpenAI 兼容）。"""

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            provider_key="deepseek",
            api_key=settings.deepseek_api_key.get_secret_value(),
            base_url=settings.deepseek_base_url,
            model=settings.deepseek_model,
        )


class QwenProvider(_OpenAICompatProvider):
    """通义千问（DashScope OpenAI 兼容模式）。"""

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            provider_key="tongyi",
            api_key=settings.qwen_api_key.get_secret_value(),
            base_url=settings.qwen_base_url,
            model=settings.qwen_model,
        )


# 单例缓存：运行期单一 provider，不协同切换
_SINGLETON: Provider | None = None
_SINGLETON_KEY: str | None = None


def get_provider(settings: Settings) -> Provider:
    """按 MODEL_PROVIDER 返回单例 provider（运行期不切换）。

    切换仅改配置 → 重启加载新 provider（符合"改 .env 重启"口径）。
    """
    global _SINGLETON, _SINGLETON_KEY
    key = settings.model_provider.value
    if _SINGLETON is not None and key == _SINGLETON_KEY:
        return _SINGLETON

    mapping: dict[str, Callable[[Settings], Provider]] = {
        ModelProvider.GLM.value: ZhipuProvider,
        ModelProvider.DEEPSEEK.value: DeepSeekProvider,
        ModelProvider.QWEN.value: QwenProvider,
    }
    factory = mapping.get(key)
    if factory is None:  # pragma: no cover - StrEnum 保证不到达
        raise ValueError(f"未知 MODEL_PROVIDER: {key}")

    _SINGLETON = factory(settings)
    _SINGLETON_KEY = key
    return _SINGLETON


def reset_provider_for_tests() -> None:
    """重置单例缓存（仅测试用）。"""
    global _SINGLETON, _SINGLETON_KEY
    _SINGLETON = None
    _SINGLETON_KEY = None


__all__ = [
    "DeepSeekProvider",
    "Provider",
    "QwenProvider",
    "ZhipuProvider",
    "get_provider",
    "reset_provider_for_tests",
]
