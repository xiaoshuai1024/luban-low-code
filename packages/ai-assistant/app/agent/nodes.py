"""LangGraph agent 各节点（纯函数：读 AgentState → 写 AgentState）。

节点：understand / retrieve / generate / validate / hitl / feedback
依赖（provider/retriever/registry）经 AgentDeps 注入，便于单测 mock。

回环：validate 失败 → feedback → generate（重试 ≤ max_retries），超限 → failed。
HITL：整页/覆盖/删除生成 → hitl 中断等待用户确认；单属性编辑 → 跳过 hitl。
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.agent.state import AgentState, SessionStatus
from app.llm.provider import Provider
from app.rag.retriever import RetrievedMaterial, Retriever
from app.schemas.page_schema import PageSchema
from app.schemas.validators import MaterialRegistry, collect_missing_materials

logger = logging.getLogger(__name__)


# ===== 结构化输出模型（喂给 provider.chat）=====


class GenerationIntent(BaseModel):
    """understand 节点：意图分类。"""

    kind: str = Field(description="generate_page | edit_property | guidance | unknown")
    summary: str = Field(description="用户意图一句话总结")


class GeneratedSchema(BaseModel):
    """generate 节点：LLM 产出的 PageSchema（待校验闸）。"""

    root: dict[str, Any]
    form_state: dict[str, Any] | None = None


# ===== 依赖注入容器 =====


@dataclass
class AgentDeps:
    """agent 运行依赖（全部可 mock）。"""

    provider: Provider
    retriever: Retriever
    registry: MaterialRegistry
    system_prompt: str = (
        "你是 luban 低代码平台的页面生成助手。根据用户需求生成符合 PageSchema "
        "规范的页面结构，只能使用已知物料。输出严格 JSON。"
    )


# ===== 节点 =====


async def understand(state: AgentState, deps: AgentDeps) -> AgentState:
    """理解意图（结构化分类）。"""
    state.status = SessionStatus.GENERATING
    state.add_progress("progress", message="正在理解需求…")
    try:
        raw_intent = deps.provider.chat(
            [
                SystemMessage(content="判断用户意图，分类为 generate_page/edit_property/guidance/unknown。"),
                HumanMessage(content=state.user_message),
            ],
            response_model=GenerationIntent,
        )
        intent: GenerationIntent = raw_intent  # type: ignore[assignment]
        state.add_progress("tool", tool="understand", result=intent.kind)
    except Exception as e:
        # LLM 失败：默认走 generate_page（保守降级，不阻断）
        logger.warning("understand 失败，降级为 generate_page: %s", e)
        intent = GenerationIntent(kind="generate_page", summary=state.user_message)
        state.add_progress("tool", tool="understand", result="generate_page(fallback)")
    # 存意图到 progress（节点间传递用 dict，避免改 AgentState 结构）
    state.add_progress("intent", kind=intent.kind, summary=intent.summary)
    return state


async def retrieve(state: AgentState, deps: AgentDeps) -> AgentState:
    """RAG 检索相关物料（供 generate 上下文）。"""
    state.add_progress("progress", message="正在检索物料…")
    try:
        results: list[RetrievedMaterial] = deps.retriever.search(state.user_message, top_k=8)
        state.retrieved_materials = [r.name for r in results]
        state.add_progress("tool", tool="retrieve", materials=state.retrieved_materials)
    except Exception as e:
        # RAG 故障降级：全量物料 prompt 兜底
        logger.warning("retrieve 失败，降级为空检索: %s", e)
        state.retrieved_materials = list(deps.registry.materials.keys())
        state.add_progress("tool", tool="retrieve(fallback)", materials=state.retrieved_materials)
    return state


async def generate(state: AgentState, deps: AgentDeps) -> AgentState:
    """调用 LLM 生成 PageSchema（结构化）。"""
    state.add_progress("progress", message="正在生成页面结构…")

    # 拼上下文：可用物料清单 + 当前 schema（编辑链路）
    materials_ctx = json.dumps(
        [
            {"name": n, "propsSchema": p}
            for n, p in deps.registry.materials.items()
        ],
        ensure_ascii=False,
    )
    current_ctx = (
        state.current_schema.model_dump_json(by_alias=True)
        if state.current_schema
        else "（空页面）"
    )
    prompt = (
        f"可用物料：{materials_ctx}\n"
        f"当前画布 schema：{current_ctx}\n"
        f"用户需求：{state.user_message}\n"
        f"生成一个 luban PageSchema。root 是根节点(type=LubanPage)，children 含具体物料。"
        f"props 须符合对应物料的 propsSchema。"
    )
    try:
        raw_gen = deps.provider.chat(
            [SystemMessage(content=deps.system_prompt), HumanMessage(content=prompt)],
            response_model=GeneratedSchema,
        )
        gen: GeneratedSchema = raw_gen  # type: ignore[assignment]
        page = PageSchema.model_validate(
            {"root": gen.root, "formState": gen.form_state or {}}
        )
        state.generated_schema = page
        state.add_progress("tool", tool="generate", ok=True)
    except Exception as e:
        logger.warning("generate 失败: %s", e)
        state.error = f"生成失败: {e}"
        state.add_progress("tool", tool="generate", ok=False, error=str(e))
    return state


async def validate(state: AgentState, deps: AgentDeps) -> AgentState:
    """校验闸（结构/物料/props/表达式/循环/ID）。失败 → feedback 回环。"""
    if state.generated_schema is None:
        state.error = state.error or "无生成产物"
        state.status = SessionStatus.FAILED
        return state

    from app.schemas.validators import validate_page_schema

    try:
        validated = validate_page_schema(state.generated_schema, deps.registry)
        state.generated_schema = validated
        state.error = None  # 校验通过 → 清除瞬时错误，使路由进 hitl
        missing = collect_missing_materials(validated, deps.registry)
        if missing:
            state.add_progress("warning", missing_materials=missing)
        state.add_progress("tool", tool="validate", ok=True)
        return state
    except Exception as e:
        state.retries += 1
        state.add_progress("tool", tool="validate", ok=False, error=str(e), retry=state.retries)
        # 设置瞬时错误 → route_after_validate 进 feedback 回环
        state.error = f"校验失败: {e}"
        if state.retries >= state.max_retries:
            state.error = f"校验失败超限({state.retries}次): {e}"
            state.status = SessionStatus.FAILED
        return state


def route_after_validate(state: AgentState) -> str:
    """校验后路由：通过→hitl；失败→feedback（回环）或 failed。"""
    if state.status == SessionStatus.FAILED:
        return "failed"
    if state.generated_schema is not None and state.error is None:
        return "hitl"
    return "feedback"


async def hitl(state: AgentState, _deps: AgentDeps) -> AgentState:
    """HITL 中断：整页/覆盖/删除须确认（awaiting_confirm）；单属性跳过。"""
    # P1：整页生成默认需确认（Q5）。单属性编辑 needs_confirm=False。
    state.needs_confirm = True  # 由 generate 根据意图设置更精确，此处保守为 True
    if state.needs_confirm:
        state.status = SessionStatus.AWAITING_CONFIRM
        state.interrupted = True
        state.add_progress("confirm", message="生成完成，等待确认")
    else:
        state.status = SessionStatus.APPLIED
        state.add_progress("done", message="已应用")
    return state


async def feedback(state: AgentState, _deps: AgentDeps) -> AgentState:
    """回环：把校验错误反馈给 generate 重试。"""
    state.add_progress("tool", tool="feedback", message="校验失败，重试生成")
    return state
