"""LangGraph agent 状态图装配 + 运行器。

状态图：
  START → understand → retrieve → generate → validate
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                        hitl       feedback       failed
                          │            │(回环)
                          ▼            └→ generate
                       (awaiting_confirm / applied)

路由 route_after_validate：validate 通过→hitl；失败未超限→feedback→generate；超限→failed。

运行器 AgentRunner：注入 AgentDeps（provider/retriever/registry，可 mock），
提供 async run(state) 推进状态图。LangGraph 的 conditional_edges 用于回环路由。
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from app.agent.checkpoint import CheckpointStore
from app.agent.nodes import AgentDeps, feedback, generate, hitl, retrieve, understand, validate
from app.agent.state import AgentState, SessionStatus

logger = logging.getLogger(__name__)

# 节点签名：(AgentState, AgentDeps) -> Awaitable[AgentState]
NodeFn = Callable[[AgentState, AgentDeps], Awaitable[AgentState]]


class AgentRunner:
    """agent 状态图运行器（deps 可 mock，不依赖真实 LLM/容器）。

    用显式节点编排实现状态图语义（而非强绑 langgraph.StateGraph API，
    便于单测与版本无关）。回环由 route_after_validate + run 循环驱动。
    """

    def __init__(self, deps: AgentDeps, store: CheckpointStore | None = None) -> None:
        self.deps = deps
        self.store = store
        # 节点注册表（可被测试替换）
        self.nodes: dict[str, NodeFn] = {
            "understand": understand,
            "retrieve": retrieve,
            "generate": generate,
            "validate": validate,
            "hitl": hitl,
            "feedback": feedback,
        }

    async def run(self, state: AgentState) -> AgentState:
        """推进状态图到稳定态（hitl 中断 / applied / failed）。"""
        from app.agent.nodes import route_after_validate

        state = await self.nodes["understand"](state, self.deps)
        state = await self.nodes["retrieve"](state, self.deps)

        # 生成→校验→(回环) 循环，受 max_retries 限制
        while True:
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
            # route == "feedback" → 回环重试
            if state.retries >= state.max_retries:
                state.status = SessionStatus.FAILED
                state.error = state.error or "校验失败回环超限"
                break
            state = await self.nodes["feedback"](state, self.deps)
            # 持久化中间态（便于恢复）
            if self.store is not None:
                await self.store.save(state)

        # 持久化终态
        if self.store is not None:
            await self.store.save(state)
        return state

    async def resume_after_confirm(self, state: AgentState, confirmed: bool) -> AgentState:
        """HITL 确认回执：True→applied；False→rejected。"""
        state.confirmed = confirmed
        state.interrupted = False
        if confirmed:
            state.status = SessionStatus.APPLIED
            state.add_progress("done", message="用户确认，已应用")
        else:
            state.status = SessionStatus.REJECTED
            state.add_progress("done", message="用户拒绝")
        if self.store is not None:
            await self.store.save(state)
        return state


__all__ = ["AgentDeps", "AgentRunner"]
