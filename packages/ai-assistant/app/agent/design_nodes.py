"""agent/design_nodes.py — 设计稿转页面 workflow 节点（plan P2-T2）。

状态图：
  understand_image → map_to_materials → generate(refine) → validate → hitl
                         ↑                                  │(失败回环)
                         └──────────────── feedback ────────┘

节点纯函数：(DesignState, DesignDeps) -> Awaitable[DesignState]。
复用 P1 校验闸（validators.validate_page_schema）、checkpoint、provider.chat_with_image。
多模态调用 mock（单测），真实 VLM 仅冒烟用。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, cast

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.agent.mapping_rules import understanding_to_schema
from app.agent.state import SessionStatus
from app.llm.multimodal import DesignUnderstanding, build_understanding_prompt
from app.llm.provider import Provider
from app.schemas.page_schema import PageSchema
from app.schemas.validators import MaterialRegistry, collect_missing_materials
from app.storage.minio import ImageStore

logger = logging.getLogger(__name__)


class DesignState(BaseModel):
    """design workflow 状态（类似 AgentState，含图片/job 元数据）。"""

    model_config = {"arbitrary_types_allowed": True}

    # 会话/job 标识
    job_id: str
    user_id: str
    site_id: str | None = None
    page_id: str | None = None

    # 输入
    image_key: str  # MinIO key
    image_bytes: bytes | None = None  # 仅运行期持有（不序列化到 checkpoint）
    image_mime: str = "image/png"
    user_prompt: str = ""

    # 执行轨迹（前端流式）
    progress: list[dict[str, Any]] = []

    # 产物
    understanding: DesignUnderstanding | None = None
    generated_schema: PageSchema | None = None

    # 控制
    status: SessionStatus = SessionStatus.IDLE
    retries: int = 0
    max_retries: int = 3
    needs_confirm: bool = True
    error: str | None = None

    # 模型元（trace 用）
    model_provider: str | None = None
    model_name: str | None = None

    def add_progress(self, event_type: str, **extra: Any) -> None:
        import time

        self.progress.append({"type": event_type, "ts": time.time(), **extra})


@dataclass
class DesignDeps:
    """design workflow 依赖（全部可 mock）。"""

    provider: Provider
    image_store: ImageStore
    registry: MaterialRegistry
    system_prompt: str = (
        "你是 luban 低代码平台的设计稿转页面助手。读图理解布局与组件，"
        "映射到 luban 物料生成 PageSchema。不确定的组件标 uncertain。"
    )


async def understand_image(state: DesignState, deps: DesignDeps) -> DesignState:
    """多模态读图：理解布局/组件/文字（VLM 结构化输出）。"""
    state.status = SessionStatus.GENERATING
    state.add_progress("progress", message="正在理解设计稿…")

    # 拉取图片字节（若未注入）
    if state.image_bytes is None:
        try:
            state.image_bytes = deps.image_store.get_object(state.image_key)
        except Exception as e:
            state.status = SessionStatus.FAILED
            state.error = f"图片获取失败: {e}"
            state.add_progress("error", message=str(e))
            return state

    known_materials = list(deps.registry.materials.keys())
    prompt_lines = build_understanding_prompt(known_materials)
    try:
        raw = deps.provider.chat_with_image(
            [
                SystemMessage(content="\n".join(prompt_lines)),
                HumanMessage(content=state.user_prompt or "请识别这个设计稿的布局、组件和文字。"),
            ],
            image_bytes=state.image_bytes,
            image_mime=state.image_mime,
            response_model=DesignUnderstanding,
        )
        understood = cast("DesignUnderstanding", raw)
        state.understanding = understood
        state.add_progress(
            "tool",
            tool="understand_image",
            result=f"识别到 {len(understood.components)} 个组件",
        )
        state.add_progress(
            "progress",
            message=f"布局：{understood.layout}；标题：{understood.title or '无'}",
        )
    except Exception as e:
        logger.warning("understand_image 失败: %s", e)
        state.status = SessionStatus.FAILED
        state.error = f"设计稿理解失败: {e}"
        state.add_progress("error", message=str(e))
    return state


async def map_to_materials(state: DesignState, deps: DesignDeps) -> DesignState:
    """把理解结果映射到 luban 物料 → 初版 PageSchema。"""
    if state.understanding is None:
        state.status = SessionStatus.FAILED
        state.error = state.error or "无理解结果"
        return state

    state.add_progress("progress", message="正在映射物料…")
    known = set(deps.registry.materials.keys())
    root = understanding_to_schema(state.understanding, known_materials=known)
    state.generated_schema = PageSchema(root=root)
    state.add_progress("tool", tool="map_to_materials", ok=True)
    return state


async def generate(state: DesignState, deps: DesignDeps) -> DesignState:
    """精修：用 LLM（文本，可选）润色映射结果。

    P2 初版：map_to_materials 已产出可用 schema，此节点作为回环重试时的
    refinement 入口（把校验错误反馈给 LLM 重生成）。首版直接透传。
    """
    if state.generated_schema is None:
        state.status = SessionStatus.FAILED
        state.error = "无生成产物"
        return state
    state.add_progress("progress", message="生成 schema…")
    state.add_progress("tool", tool="generate", ok=True)
    return state


async def validate(state: DesignState, deps: DesignDeps) -> DesignState:
    """校验闸（复用 P1 validators）。失败 → feedback 回环。"""
    if state.generated_schema is None:
        state.error = state.error or "无生成产物"
        state.status = SessionStatus.FAILED
        return state

    from app.schemas.validators import validate_page_schema

    try:
        validated = validate_page_schema(state.generated_schema, deps.registry)
        state.generated_schema = validated
        state.error = None
        missing = collect_missing_materials(validated, deps.registry)
        if missing:
            state.add_progress("warning", missing_materials=missing)
        state.add_progress("tool", tool="validate", ok=True)
        return state
    except Exception as e:
        state.retries += 1
        state.add_progress("tool", tool="validate", ok=False, error=str(e), retry=state.retries)
        state.error = f"校验失败: {e}"
        if state.retries >= state.max_retries:
            state.error = f"校验失败超限({state.retries}次): {e}"
            state.status = SessionStatus.FAILED
        return state


def route_after_validate(state: DesignState) -> str:
    if state.status == SessionStatus.FAILED:
        return "failed"
    if state.generated_schema is not None and state.error is None:
        return "hitl"
    return "feedback"


async def hitl(state: DesignState, _deps: DesignDeps) -> DesignState:
    """HITL：设计稿整页生成须确认（awaiting_confirm）。"""
    state.needs_confirm = True
    state.status = SessionStatus.AWAITING_CONFIRM
    state.add_progress("confirm", message="生成完成，等待确认")
    return state


async def feedback(state: DesignState, _deps: DesignDeps) -> DesignState:
    """回环：把校验错误反馈给 map_to_materials/generate 重试。"""
    state.add_progress("tool", tool="feedback", message="校验失败，重试映射")
    return state


__all__ = [
    "DesignDeps",
    "DesignState",
    "feedback",
    "generate",
    "hitl",
    "map_to_materials",
    "route_after_validate",
    "understand_image",
    "validate",
]
