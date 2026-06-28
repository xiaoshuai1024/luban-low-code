"""P1-T6 WebSocket 端点单测。"""

from __future__ import annotations

import json
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from starlette.websockets import WebSocketDisconnect

from app.agent.state import AgentState, SessionStatus
from app.core.config import Settings
from app.main import create_app
from app.schemas.page_schema import NodeSchema, PageSchema


def _settings(**over: Any) -> Settings:
    base = dict(
        environment="test",
        auth_jwt_secret=SecretStr("test-jwt-secret-min-32-bytes-long!!"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
    )
    base.update(over)
    return Settings(**base)


def _token(settings: Settings, sub: str = "user1") -> str:
    return jwt.encode(
        {"sub": sub, "username": "t", "role": "admin"},
        settings.auth_jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


class MockRunner:
    def __init__(self, final: SessionStatus, schema: PageSchema | None = None) -> None:
        self._final = final
        self._schema = schema

    async def run(self, state: AgentState) -> AgentState:
        state.add_progress("progress", message="生成中…")
        state.add_progress("tool", tool="generate", ok=True)
        state.generated_schema = self._schema
        state.status = self._final
        if self._final == SessionStatus.AWAITING_CONFIRM:
            state.interrupted = True
        return state


def _client(settings: Settings, runner: MockRunner | None = None) -> TestClient:
    app = create_app(settings=settings)
    if runner is not None:
        from app.api.ai_deps import get_agent_runner

        app.dependency_overrides[get_agent_runner] = lambda: runner
    return app


# ===== 鉴权拒绝 =====


def test_ws_rejects_without_token() -> None:
    app = _client(_settings())
    with pytest.raises(WebSocketDisconnect), TestClient(app).websocket_connect("/ai/agent"):
        pass  # 连接应立即被拒（缺 token）


def test_ws_rejects_invalid_token() -> None:
    app = _client(_settings())
    with pytest.raises(WebSocketDisconnect) as exc:
        TestClient(app).websocket_connect("/ai/agent?token=invalid").__enter__()
    assert exc.value.code == 4401


# ===== 消息处理 =====


def test_ws_handles_message_and_streams() -> None:
    settings = _settings()
    schema = PageSchema(root=NodeSchema(id="r", type="LubanPage"))
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM, schema=schema)
    app = _client(settings, runner)
    with TestClient(app).websocket_connect(f"/ai/agent?token={_token(settings)}") as ws:
        ws.send_text(json.dumps({"type": "message", "message": "做一个按钮页"}))
        received = []
        for _ in range(10):
            try:
                msg = json.loads(ws.receive_text())
                received.append(msg)
                if msg.get("type") == "confirm":
                    break
            except WebSocketDisconnect:
                break
    types = [m.get("type") for m in received]
    assert "progress" in types or "tool" in types
    assert "confirm" in types


def test_ws_unknown_message_type_rejected() -> None:
    settings = _settings()
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM)
    app = _client(settings, runner)
    with TestClient(app).websocket_connect(f"/ai/agent?token={_token(settings)}") as ws:
        ws.send_text(json.dumps({"type": "garbage"}))
        msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"


def test_ws_invalid_json_rejected() -> None:
    settings = _settings()
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM)
    app = _client(settings, runner)
    with TestClient(app).websocket_connect(f"/ai/agent?token={_token(settings)}") as ws:
        ws.send_text("not json")
        msg = json.loads(ws.receive_text())
        assert msg["type"] == "error"


def test_ws_pong_acknowledged() -> None:
    settings = _settings()
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM)
    app = _client(settings, runner)
    with TestClient(app).websocket_connect(f"/ai/agent?token={_token(settings)}") as ws:
        ws.send_text(json.dumps({"type": "message", "message": "x"}))
        # 消费到 confirm 后再发 pong（不报错即通过）
        for _ in range(10):
            msg = json.loads(ws.receive_text())
            if msg.get("type") == "confirm":
                break
        ws.send_text(json.dumps({"type": "pong"}))
        # pong 不产生 error（继续可收心跳/新消息）


def test_ws_confirm_acknowledged() -> None:
    settings = _settings()
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM)
    app = _client(settings, runner)
    with TestClient(app).websocket_connect(f"/ai/agent?token={_token(settings)}") as ws:
        ws.send_text(json.dumps({"type": "confirm", "confirmed": True}))
        msg = json.loads(ws.receive_text())
        assert msg["type"] == "ack"
        assert msg["received"] == "confirm"
