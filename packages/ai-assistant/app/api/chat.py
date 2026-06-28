"""SSE 流式端点：POST /ai/chat + POST /ai/generate。

事件类型（§9.2 契约）：progress | tool | patch | confirm | done | error
鉴权（M3 后）：BFF 服务间信任(get_bff_user 校验 X-Internal-Token + 读 X-User-Id/Role)。

流式实现：驱动 AgentRunner.run，边跑边把 state.progress 的新增事件 yield 出去。
生成完成 → confirm/done/error 事件。
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.agent.checkpoint import new_session_id
from app.agent.graph import AgentRunner
from app.agent.state import AgentState, SessionStatus
from app.api.ai_deps import get_agent_runner
from app.api.errors import FeatureDisabledError
from app.auth.bff_user import AuthUser, get_bff_user

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    model_config = {"populate_by_name": True}

    site_id: str | None = Field(default=None, alias="siteId")
    page_id: str | None = Field(default=None, alias="pageId")
    message: str
    context: dict[str, Any] | None = None  # {currentSchema?}


class GenerateRequest(BaseModel):
    model_config = {"populate_by_name": True}

    site_id: str | None = Field(default=None, alias="siteId")
    page_id: str | None = Field(default=None, alias="pageId")
    prompt: str
    context: dict[str, Any] | None = None


def _sse(event: dict[str, Any]) -> str:
    return json.dumps(event, ensure_ascii=False, default=str)


async def _stream_agent(runner: AgentRunner, state: AgentState) -> EventSourceResponse:
    """跑 agent 并流式回传 progress → 终态事件。"""

    async def event_gen() -> AsyncGenerator[dict[str, str], None]:
        sent = 0
        # 异步跑 agent；同时轮询 progress 增量
        task = asyncio.create_task(runner.run(state))
        while not task.done():
            new_events = state.progress[sent:]
            for ev in new_events:
                yield {"event": ev.get("type", "progress"), "data": _sse(ev)}
                sent += 1
            await asyncio.sleep(0.02)
        # 刷剩余
        for ev in state.progress[sent:]:
            yield {"event": ev.get("type", "progress"), "data": _sse(ev)}

        # 终态事件
        if state.status == SessionStatus.AWAITING_CONFIRM:
            yield {
                "event": "confirm",
                "data": _sse(
                    {
                        "type": "confirm",
                        "session_id": state.session_id,
                        "schema": state.generated_schema.model_dump(by_alias=True)
                        if state.generated_schema
                        else None,
                    }
                ),
            }
        elif state.status == SessionStatus.FAILED:
            yield {
                "event": "error",
                "data": _sse({"type": "error", "message": state.error or "生成失败"}),
            }
        else:
            yield {"event": "done", "data": _sse({"type": "done", "status": state.status.value})}

    return EventSourceResponse(event_gen())


@router.post("/chat")
async def chat(
    req: ChatRequest,
    user: AuthUser = Depends(get_bff_user),
    runner: AgentRunner = Depends(get_agent_runner),
) -> EventSourceResponse:
    """自然语言对话生成/编辑页面（SSE 流式）。"""
    state = AgentState(
        session_id=new_session_id(),
        user_id=user.user_id,
        site_id=req.site_id,
        page_id=req.page_id,
        user_message=req.message,
    )
    return await _stream_agent(runner, state)


@router.post("/generate")
async def generate(
    request: Request,
    req: GenerateRequest,
    user: AuthUser = Depends(get_bff_user),
    runner: AgentRunner = Depends(get_agent_runner),
) -> EventSourceResponse:
    """生成页面（SSE 流式）。ai.generate FeatureGate 关 → 503。"""
    settings = request.app.state.settings
    if not settings.ai_generate_enabled:
        raise FeatureDisabledError("ai.generate 未启用")
    state = AgentState(
        session_id=new_session_id(),
        user_id=user.user_id,
        site_id=req.site_id,
        page_id=req.page_id,
        user_message=req.prompt,
    )
    return await _stream_agent(runner, state)
