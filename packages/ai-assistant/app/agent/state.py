"""LangGraph agent 会话状态（状态机：idle→generating→awaiting_confirm→applied|rejected|failed）。

AgentState 是 LangGraph 各节点共享的载体：进/出每个节点都读写它。
checkpoint 把 AgentState 持久化到 PostgreSQL，会话可恢复（§3 事务边界）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.page_schema import PageSchema


class SessionStatus(StrEnum):
    IDLE = "idle"
    GENERATING = "generating"
    AWAITING_CONFIRM = "awaiting_confirm"
    APPLIED = "applied"
    REJECTED = "rejected"
    FAILED = "failed"


class AgentState(BaseModel):
    """LangGraph 节点共享状态。"""

    model_config = {"arbitrary_types_allowed": True}

    # 会话标识
    session_id: str
    user_id: str
    site_id: str | None = None
    page_id: str | None = None

    # 用户输入 + 上下文
    user_message: str = ""
    current_schema: PageSchema | None = None  # 编辑链路：当前画布 schema

    # agent 执行轨迹（供前端流式显示）
    progress: list[dict[str, Any]] = Field(default_factory=list)
    retrieved_materials: list[str] = Field(default_factory=list)  # 物料名清单

    # 生成产物
    generated_schema: PageSchema | None = None
    # 待应用 patch（增量编辑：单节点 patch；整页：完整 schema）
    patch: dict[str, Any] | None = None

    # 控制
    status: SessionStatus = SessionStatus.IDLE
    retries: int = 0  # 校验失败回环计数
    max_retries: int = 3
    needs_confirm: bool = False  # HITL：整页/覆盖/删除→True；单属性→False
    error: str | None = None

    # HITL 中断/恢复
    interrupted: bool = False
    confirmed: bool | None = None  # awaiting_confirm 时由用户回填

    def add_progress(self, event_type: str, **extra: Any) -> None:
        """记录一个 agent 进度事件（前端流式消费）。"""
        import time

        self.progress.append({"type": event_type, "ts": time.time(), **extra})
