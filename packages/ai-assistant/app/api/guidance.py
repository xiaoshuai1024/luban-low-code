"""引导端点：GET /ai/guidance — 读当前 schema 给下一步建议。

FeatureGate ai.guidance 关 → 503。
不调用 LLM（规则化建议，避免延迟/成本）；如需更智能建议可后续接 agent。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.agent.guidance import GuidanceTip, generate_guidance
from app.api.errors import FeatureDisabledError
from app.auth.jwt import AuthUser, get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


class GuidanceResponse(BaseModel):
    tips: list[dict[str, Any]]
    schema_empty: bool


@router.get("/guidance")
async def guidance(
    request: Request,
    user: AuthUser = Depends(get_current_user),
    empty: bool = Query(default=True, description="画布是否为空"),
) -> GuidanceResponse:
    """读当前 schema 状态给引导建议。"""
    settings = request.app.state.settings
    if not settings.ai_guidance_enabled:
        raise FeatureDisabledError("ai.guidance 未启用")

    # P1：规则化引导，schema 经前端 query 参数简化传递（empty 标志）。
    # 真实 schema 由 registry 上下文补充，此处用已知物料集。
    from app.api.ai_deps import get_agent_deps

    deps = get_agent_deps(settings)
    known = set(deps.registry.materials.keys())

    tips = generate_guidance(
        schema=None if empty else _placeholder_schema(),
        known_materials=known,
    )
    return GuidanceResponse(
        tips=[_tip_to_dict(t) for t in tips],
        schema_empty=empty,
    )


def _tip_to_dict(t: GuidanceTip) -> dict[str, Any]:
    return {"level": t.level, "title": t.title, "detail": t.detail, "action": t.action}


def _placeholder_schema() -> Any:
    """非空 schema 占位（P1：前端传 empty 标志；后续可传完整 schema）。"""
    from app.schemas.page_schema import NodeSchema, PageSchema

    return PageSchema(
        root=NodeSchema(
            id="root", type="LubanPage", children=[NodeSchema(id="f", type="LubanForm")]
        )
    )
