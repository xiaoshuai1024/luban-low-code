"""trace 抽象（可观测占位）。

设计：
- Tracer 抽象 + NoopTracer（默认）。
- trace() 上下文管理器：包住一段执行，产出 span（name/input/output/metadata）。
- PII 安全：调用方传入的 input 须已脱敏（guard_input 后）；Tracer 不做额外记录。

迁移说明（M0）：Langfuse 自托管可观测已移除（新方案 MVP 不引）。
本文件保留 Tracer/NoopTracer 占位，供后续接入其他可观测（如 OTel）。
"""

from __future__ import annotations

import contextlib
import logging
import time
from collections.abc import Iterator
from typing import Any

logger = logging.getLogger(__name__)


class Tracer:
    """trace 抽象。"""

    @contextlib.contextmanager
    def trace(self, name: str, *, input: Any = None, **metadata: Any) -> Iterator[dict[str, Any]]:
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
    """空实现（默认，不连任何外部服务）。"""


def get_tracer(settings: Any = None) -> Tracer:
    """返回 tracer。迁移后默认 NoopTracer。

    Args:
        settings: 保留参数签名兼容旧调用（M0 后不再读 settings 字段）。

    TODO(后续): 接入 OTel 等可观测后，按配置返回对应 Tracer 实现。
    """
    return NoopTracer()
