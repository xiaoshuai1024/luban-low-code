"""Langfuse trace 接入（agent/LLM 调用全链路可观测）。

设计：
- Tracer 抽象，NoopTracer（未配置 key 时）/ LangfuseTracer（生产）。
- trace() 上下文管理器：包住一段执行，产出 span（name/input/output/metadata）。
- PII 安全：调用方传入的 input 须已脱敏（guard_input 后）；Tracer 不做额外记录，
  仅透传。避免敏感原文进 Langfuse。
- 测试用 NoopTracer（不连真实 Langfuse）。
"""

from __future__ import annotations

import contextlib
import logging
import time
from collections.abc import Iterator
from typing import Any

from app.core.config import Settings

logger = logging.getLogger(__name__)


class Tracer:
    """trace 抽象。"""

    @contextlib.contextmanager
    def trace(
        self, name: str, *, input: Any = None, **metadata: Any
    ) -> Iterator[dict[str, Any]]:
        """包住一段执行。yield 一个 dict，调用方可填 output/error 后随 span 上报。"""
        span: dict[str, Any] = {
            "name": name,
            "input": input,
            "metadata": metadata,
            "start": time.time(),
        }
        try:
            yield span
        finally:
            span["duration_ms"] = (time.time() - span["start"]) * 1000


class NoopTracer(Tracer):
    """空实现（测试/未配置 Langfuse 时用，不连任何外部服务）。"""


class LangfuseTracer(Tracer):
    """生产 Langfuse 实现（自托管）。

    使用 langfuse Python SDK 的 observe/span。仅当配置了 key/host 时启用。
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from langfuse import Langfuse

            self._client = Langfuse(
                host=self._settings.langfuse_host,
                public_key=self._settings.langfuse_public_key.get_secret_value(),
                secret_key=self._settings.langfuse_secret_key.get_secret_value(),
            )
        return self._client

    @contextlib.contextmanager
    def trace(
        self, name: str, *, input: Any = None, **metadata: Any
    ) -> Iterator[dict[str, Any]]:
        span = {
            "name": name,
            "input": input,
            "metadata": metadata,
            "start": time.time(),
        }
        client = None
        try:
            client = self._get_client()
        except Exception as e:
            # Langfuse 不可用不应阻断主流程
            logger.warning("Langfuse 连接失败，降级为本地 span: %s", e)

        if client is not None:
            try:
                obs = client.start_observation(name=name, input=input, metadata=metadata)
                span["_obs"] = obs
            except Exception as e:
                logger.warning("Langfuse start_observation 失败: %s", e)

        try:
            yield span
        finally:
            span["duration_ms"] = (time.time() - span["start"]) * 1000
            obs = span.get("_obs")
            if obs is not None:
                try:
                    output = span.get("output")
                    obs.end(output=output)
                except Exception as e:
                    logger.warning("Langfuse end 失败: %s", e)


def get_tracer(settings: Settings) -> Tracer:
    """按配置返回 tracer：配置了 key → LangfuseTracer；否则 NoopTracer。"""
    if (
        settings.langfuse_public_key.get_secret_value()
        and settings.langfuse_secret_key.get_secret_value()
        and settings.environment not in ("test",)
    ):
        try:
            return LangfuseTracer(settings)
        except Exception as e:
            logger.warning("LangfuseTracer 初始化失败，降级 Noop: %s", e)
    return NoopTracer()
