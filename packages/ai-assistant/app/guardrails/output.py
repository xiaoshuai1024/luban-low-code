"""输出 guardrail：校验 LLM 产物合法（兜底校验闸）。

复用 app.schemas.validators.validate_page_schema 做结构/物料/props 校验。
校验失败 → 记录 + 触发 agent 回环（不发非法 schema 到前端）。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.page_schema import PageSchema
from app.schemas.validators import MaterialRegistry, validate_page_schema


@dataclass
class OutputCheckResult:
    ok: bool
    error: str | None
    schema: PageSchema | None


def check_output(page: PageSchema, registry: MaterialRegistry) -> OutputCheckResult:
    """输出闸：校验 schema 合法。失败返回 ok=False + error（不发到前端）。"""
    try:
        validated = validate_page_schema(page, registry)
        return OutputCheckResult(ok=True, error=None, schema=validated)
    except Exception as e:
        return OutputCheckResult(ok=False, error=str(e), schema=None)
