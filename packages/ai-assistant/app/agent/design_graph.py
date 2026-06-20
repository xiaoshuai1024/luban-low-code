"""agent/design_graph.py — 设计稿转页面 workflow 运行器（plan P2-T2）。

复用 AgentRunner 的显式节点编排模式（非强绑 langgraph.StateGraph API，
便于单测与版本无关）。状态图：
  understand_image → map_to_materials → generate → validate → hitl
                                              ↑(回环) feedback

回环：validate 失败未超限 → feedback → map_to_materials 重映射；超限 → failed。
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from app.agent.design_nodes import (
    DesignDeps,
    DesignState,
    feedback,
    generate,
    hitl,
    map_to_materials,
    route_after_validate,
    understand_image,
    validate,
)
from app.agent.state import SessionStatus

logger = logging.getLogger(__name__)

NodeFn = Callable[[DesignState, DesignDeps], Awaitable[DesignState]]


class DesignRunner:
    """design workflow 运行器（deps 可 mock，不依赖真实 VLM/MinIO）。"""

    def __init__(self, deps: DesignDeps) -> None:
        self.deps = deps
        self.nodes: dict[str, NodeFn] = {
            "understand_image": understand_image,
            "map_to_materials": map_to_materials,
            "generate": generate,
            "validate": validate,
            "hitl": hitl,
            "feedback": feedback,
        }

    async def run(self, state: DesignState) -> DesignState:
        """推进 workflow 到稳定态（hitl 中断 / failed）。"""
        state = await self.nodes["understand_image"](state, self.deps)
        if state.status == SessionStatus.FAILED:
            return state

        while True:
            state = await self.nodes["map_to_materials"](state, self.deps)
            state = await self.nodes["generate"](state, self.deps)
            if state.status == SessionStatus.FAILED:
                break
            state = await self.nodes["validate"](state, self.deps)

            route = route_after_validate(state)
            if route == "failed":
                state.status = SessionStatus.FAILED
                break
            if route == "hitl":
                state = await self.nodes["hitl"](state, self.deps)
                break
            if state.retries >= state.max_retries:
                state.status = SessionStatus.FAILED
                state.error = state.error or "校验失败回环超限"
                break
            state = await self.nodes["feedback"](state, self.deps)

        return state

    async def resume_after_confirm(self, state: DesignState, confirmed: bool) -> DesignState:
        """HITL 确认回执。"""
        if confirmed:
            state.status = SessionStatus.APPLIED
            state.add_progress("done", message="用户确认，已应用")
        else:
            state.status = SessionStatus.REJECTED
            state.add_progress("done", message="用户拒绝")
        return state


__all__ = ["DesignDeps", "DesignRunner"]
