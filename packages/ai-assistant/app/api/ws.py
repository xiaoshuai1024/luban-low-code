"""WebSocket 端点：WS /ai/agent（多步 agent，心跳+重连）。

双向消息：
  - 客户端 → {type: message|confirm, ...}
  - 服务端 → {type: progress|tool|confirm|done|error, ...}

鉴权：query param ?token=<jwt>（WS 不便用 Header，AI 服务自验）。
心跳：服务端每 15s 发 {type:ping}；客户端可回 {type:pong}。

P1：WS 复用 AgentRunner，语义与 SSE /ai/chat 等价（多步交互由前端选通道）。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from app.agent.checkpoint import new_session_id
from app.agent.graph import AgentRunner
from app.agent.state import AgentState, SessionStatus
from app.api.ai_deps import get_agent_runner
from app.api.errors import UnauthenticatedError
from app.core.config import Settings

router = APIRouter(prefix="/ai", tags=["ai"])

HEARTBEAT_SECONDS = 15


def _auth_ws(
    internal_token: str | None, user_id: str | None, settings: Settings
) -> str:
    """WS 鉴权(M3 后):BFF 透传 internal_token + user_id 作为 query param。

    校验 internal_token(服务间信任)+ 必须有 user_id。失败抛 UnauthenticatedError(WS 关闭码 4401)。
    """
    expected = settings.ai_service_token.get_secret_value() if settings.ai_service_token else ""
    if expected and (not internal_token or internal_token != expected):
        raise UnauthenticatedError("无效 internal_token", details={"reason": "invalid"})
    if not user_id:
        raise UnauthenticatedError("缺少 user_id")
    return user_id


async def _send_json(ws: WebSocket, payload: dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload, ensure_ascii=False, default=str))


@router.websocket("/agent")
async def agent_ws(
    ws: WebSocket,
    internal_token: str | None = Query(default=None, description="BFF 服务间 token"),
    user_id: str | None = Query(default=None, description="BFF 透传用户 id"),
    runner: AgentRunner = Depends(get_agent_runner),
) -> None:
    """多步 agent WebSocket。"""
    settings: Settings = ws.app.state.settings
    try:
        resolved_user_id = _auth_ws(internal_token, user_id, settings)
    except UnauthenticatedError:
        await ws.close(code=4401)
        return

    await ws.accept()

    async def heartbeat() -> None:
        try:
            while True:
                await asyncio.sleep(HEARTBEAT_SECONDS)
                await _send_json(ws, {"type": "ping"})
        except WebSocketDisconnect:
            return

    hb = asyncio.create_task(heartbeat())
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send_json(ws, {"type": "error", "message": "非法 JSON"})
                continue

            if msg.get("type") == "pong":
                continue
            if msg.get("type") == "confirm":
                # HITL 确认回执（前端在 awaiting_confirm 后发）
                await _send_json(ws, {"type": "ack", "received": "confirm"})
                continue
            if msg.get("type") != "message":
                await _send_json(ws, {"type": "error", "message": "未知消息类型"})
                continue

            # 处理用户消息：跑 agent，流式回传 progress
            state = AgentState(
                session_id=new_session_id(),
                user_id=resolved_user_id,
                site_id=msg.get("siteId"),
                page_id=msg.get("pageId"),
                user_message=msg.get("message", ""),
            )
            sent = 0
            task = asyncio.create_task(runner.run(state))
            while not task.done():
                for ev in state.progress[sent:]:
                    await _send_json(ws, ev)
                    sent += 1
                await asyncio.sleep(0.02)
            for ev in state.progress[sent:]:
                await _send_json(ws, ev)

            # 终态
            if state.status == SessionStatus.AWAITING_CONFIRM:
                await _send_json(
                    ws,
                    {
                        "type": "confirm",
                        "session_id": state.session_id,
                        "schema": state.generated_schema.model_dump(by_alias=True)
                        if state.generated_schema
                        else None,
                    },
                )
            elif state.status == SessionStatus.FAILED:
                await _send_json(ws, {"type": "error", "message": state.error or "失败"})
            else:
                await _send_json(ws, {"type": "done", "status": state.status.value})
    except WebSocketDisconnect:
        pass
    finally:
        hb.cancel()
