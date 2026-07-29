"""LLM provider 适配层(LiteLLM 实现,运行期单一,改 MODEL_PROVIDER 切换)。

设计(M1 迁移):
- Provider 抽象基类定义统一接口 chat(结构化)/stream(流式)。
- LiteLLM 用 provider/model 前缀路由(deepseek/deepseek-chat 等),统一 100+ 厂商接口。
- 结构化输出:LiteLLM 原生 response_format(JSON schema) + 应用层重试逼近合法(去 instructor)。
- chat() 返回 Pydantic 对象(供 agent nodes.py 直接用,接口与旧版兼容)。

测试:单测 mock litellm.completion/acompletion;冒烟测试才用真实 key。
"""

from __future__ import annotations

import abc
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import BaseMessage
from litellm import acompletion, completion
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

# 结构化输出重试上限(LLM 偶尔产出非法 JSON,应用层逼近合法)
_STRUCTURED_MAX_RETRIES = 2


def _messages_to_openai(messages: list[BaseMessage]) -> list[dict[str, str]]:
    """langchain BaseMessage → OpenAI messages 格式(role/content dict)。

    保留 system/human/ai 角色顺序,供 LiteLLM 直接消费。
    """
    role_map: dict[str, str] = {
        "system": "system",
        "human": "user",
        "ai": "assistant",
        "user": "user",
        "assistant": "assistant",
    }
    out: list[dict[str, str]] = []
    for m in messages:
        # langchain BaseMessage.type / role 属性
        raw_role: str = getattr(m, "type", None) or getattr(m, "role", "user") or "user"
        role = role_map.get(raw_role, raw_role)
        content = m.content if isinstance(m.content, str) else str(m.content)
        out.append({"role": role, "content": content})
    return out


def _response_format_for(model: type[BaseModel]) -> dict[str, Any]:
    """生成 LiteLLM/OpenAI 兼容的 response_format(JSON schema 模式)。"""
    schema = model.model_json_schema()
    return {
        "type": "json_schema",
        "json_schema": {
            "name": model.__name__,
            "schema": schema,
            # strict 模式:要求 LLM 严格按 schema 输出(支持的厂商会强制)
            "strict": False,
        },
    }


def _strip_markdown_codeblock(content: str) -> str:
    """LLM 偶尔把 JSON 包在 ```json ... ``` 里(尤其未传 response_format 时)。
    去掉首尾 ``` 行,保证 json.loads 能解析。"""
    s = content.strip()
    if s.startswith("```"):
        # 去首行 ``` 或 ```json
        first_nl = s.find("\n")
        if first_nl > 0:
            s = s[first_nl + 1 :]
        if s.endswith("```"):
            s = s[: -3]
    return s.strip()


class Provider(abc.ABC):
    """LLM provider 抽象。

    chat(): 结构化输出(LiteLLM response_format + Pydantic),返回 Pydantic 对象。
    stream(): 原始 token 流(yield str),对话式流式回显。

    provider 能力声明:
    - _supports_json_schema: 是否支持 response_format=json_schema 严格模式。
      DeepSeek 当前完全不支持 response_format,设 False 走 prompt 约束路径。
    """

    _supports_json_schema: bool = True

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """展示名(如 glm-4 / deepseek-chat / qwen-plus)。"""

    @property
    @abc.abstractmethod
    def provider_key(self) -> str:
        """provider 标识(glm/deepseek/tongyi)。"""

    @property
    @abc.abstractmethod
    def litellm_model(self) -> str:
        """LiteLLM 路由 model 名(provider/model 前缀格式)。"""

    @abc.abstractmethod
    def _api_key(self) -> str:
        """厂商 API key(供 LiteLLM 调用)。"""

    def _build_response_format(self, model: type[BaseModel]) -> dict[str, Any] | None:
        """按 provider 能力构造 response_format;不支持时返回 None(走 prompt 约束)。"""
        if self._supports_json_schema:
            return _response_format_for(model)
        return None

    def _inject_json_instruction(
        self, openai_msgs: list[dict[str, str]], response_model: type[BaseModel]
    ) -> list[dict[str, str]]:
        """不支持 response_format 的 provider(如 DeepSeek):追加 JSON 约束指令。

        在 messages 末尾加一条 system message,明示只输出符合 schema 的裸 JSON
        (无 markdown 代码块),供应用层 json.loads 直接解析。
        """
        schema_hint = json.dumps(response_model.model_json_schema(), ensure_ascii=False)
        instruction = (
            "你必须只输出符合以下 JSON Schema 的合法 JSON。"
            "不要输出任何其他内容,不要用 markdown 代码块标记(禁止 ```json):\n"
            f"{schema_hint}"
        )
        return [*openai_msgs, {"role": "system", "content": instruction}]

    def chat(self, messages: list[BaseMessage], response_model: type[BaseModel]) -> BaseModel:
        """结构化输出:强制 LLM 返回符合 response_model 的 Pydantic 对象。

        - 支持 response_format 的 provider:LiteLLM json_schema 严格模式 + 应用层重试。
        - 不支持的 provider(DeepSeek):追加 prompt JSON 约束 + 应用层重试 + 去 markdown 包裹。
        LLM 偶尔产出非法 JSON 时重试(上限 _STRUCTURED_MAX_RETRIES)。
        """
        openai_msgs = _messages_to_openai(messages)
        rf = self._build_response_format(response_model)
        if rf is None:
            openai_msgs = self._inject_json_instruction(openai_msgs, response_model)

        last_err: Exception | None = None
        for attempt in range(_STRUCTURED_MAX_RETRIES + 1):
            try:
                kwargs: dict[str, Any] = {"response_format": rf} if rf is not None else {}
                resp = completion(
                    model=self.litellm_model,
                    api_key=self._api_key(),
                    messages=openai_msgs,
                    temperature=0.2,
                    **kwargs,
                )
                content = resp.choices[0].message.content
                content = _strip_markdown_codeblock(content)
                data = json.loads(content)
                return response_model.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as e:
                last_err = e
                logger.warning(
                    "chat 结构化输出第 %d 次非法,重试: %s", attempt + 1, e
                )
                continue
        # 重试耗尽:抛出最后一次错误(供 agent 节点降级处理)
        assert last_err is not None
        raise last_err

    async def stream(self, messages: list[BaseMessage]) -> AsyncIterator[str]:
        """流式输出原始 token 片段(yield str)。"""
        openai_msgs = _messages_to_openai(messages)
        # litellm.acompletion(stream=True) 直接返回 async generator,无需 await
        response = acompletion(
            model=self.litellm_model,
            api_key=self._api_key(),
            messages=openai_msgs,
            stream=True,
            temperature=0.7,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:  # 跳过 None(首个 chunk 通常只有 role)
                yield delta


class _LiteLLMCompatProvider(Provider):
    """LiteLLM OpenAI 兼容厂商基类(DeepSeek/GLM/通义 均走此路)。"""

    def __init__(
        self,
        *,
        provider_key: str,
        api_key: str,
        model: str,
        litellm_prefix: str,
    ) -> None:
        self._provider_key = provider_key
        self._api_key_value = api_key
        self._model = model
        self._litellm_prefix = litellm_prefix

    @property
    def name(self) -> str:
        return self._model

    @property
    def provider_key(self) -> str:
        return self._provider_key

    @property
    def litellm_model(self) -> str:
        return f"{self._litellm_prefix}/{self._model}"

    def _api_key(self) -> str:
        return self._api_key_value


__all__ = [
    "Provider",
    "_LiteLLMCompatProvider",
    "_messages_to_openai",
]
