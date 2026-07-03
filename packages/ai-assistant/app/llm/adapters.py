"""三家 provider 具体适配器 + 工厂(LiteLLM 实现)。

均走 LiteLLM 统一接口,仅 model 前缀/api_key 不同。
LiteLLM 用 provider/model 前缀路由:
- DeepSeek: deepseek/<model>(原生 OpenAI 兼容)
- GLM:      glm/<model>(智谱,OpenAI 兼容)
- 通义:     openai/<model> + custom_llm_provider 注入(DashScope OpenAI 兼容模式)

切换仅改 MODEL_PROVIDER → get_provider 返回对应单例。
"""

from __future__ import annotations

from collections.abc import Callable

from app.core.config import ModelProvider, Settings
from app.llm.provider import Provider, _LiteLLMCompatProvider


class ZhipuProvider(_LiteLLMCompatProvider):
    """智谱 GLM(LiteLLM glm/ 前缀)。"""

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            provider_key="glm",
            api_key=settings.glm_api_key.get_secret_value(),
            model=settings.glm_model,
            litellm_prefix="glm",
        )


class DeepSeekProvider(_LiteLLMCompatProvider):
    """DeepSeek(LiteLLM deepseek/ 前缀,原生 OpenAI 兼容)。"""

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            provider_key="deepseek",
            api_key=settings.deepseek_api_key.get_secret_value(),
            model=settings.deepseek_model,
            litellm_prefix="deepseek",
        )


class QwenProvider(_LiteLLMCompatProvider):
    """通义千问(DashScope OpenAI 兼容模式,LiteLLM openai/ 前缀)。

    通义走 OpenAI 兼容接口,LiteLLM 用 openai/<model> + api_base 指向 DashScope。
    provider_key 仍记 tongyi(业务标识),litellm_model 用 openai/ 前缀。
    """

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            provider_key="tongyi",
            api_key=settings.qwen_api_key.get_secret_value(),
            model=settings.qwen_model,
            litellm_prefix="openai",
        )


# 单例缓存:运行期单一 provider,不协同切换
_SINGLETON: Provider | None = None
_SINGLETON_KEY: str | None = None


def get_provider(settings: Settings) -> Provider:
    """按 MODEL_PROVIDER 返回单例 provider(运行期不切换)。

    切换仅改配置 → 重启加载新 provider(符合"改 .env 重启"口径)。
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
    """重置单例缓存(仅测试用)。"""
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
