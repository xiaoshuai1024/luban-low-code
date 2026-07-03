"""P1-T10 engine↔AI 服务流式契约集成测试。

验证 AI 服务 /ai/chat SSE 输出的事件结构，与 engine src/api/ai.ts 客户端解析的
契约一致（type/session_id/schema 字段名、event 名 progress/tool/confirm/done/error）。

不启 engine（TS），只起 AI 服务（mock AgentRunner），用 SSE 原始文本断言契约字段。
"""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import SecretStr

from app.agent.state import AgentState, SessionStatus
from app.core.config import Settings
from app.main import create_app
from app.schemas.page_schema import NodeSchema, PageSchema


def _settings() -> Settings:
    return Settings(_env_file=None, 
        environment="test",
        auth_jwt_secret=SecretStr("test-jwt-secret-min-32-bytes-long!!"),
        ai_service_token=SecretStr("test-internal-token"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
    )


def _bff_headers(user_id: str = "user1", role: str = "admin") -> dict[str, str]:
    """M3 BFF 服务间信任 header。"""
    return {"X-Internal-Token": "test-internal-token", "X-User-Id": user_id, "X-User-Role": role}


class _MockRunner:
    """模拟 agent：产 progress + tool 事件，终态 awaiting_confirm + schema。"""

    def __init__(self, schema: PageSchema) -> None:
        self._schema = schema

    async def run(self, state: AgentState) -> AgentState:
        state.add_progress("progress", message="正在生成…")
        state.add_progress("tool", tool="generate", ok=True)
        state.generated_schema = self._schema
        state.status = SessionStatus.AWAITING_CONFIRM
        state.interrupted = True
        return state

    async def resume_after_confirm(self, state: AgentState, confirmed: bool) -> AgentState:
        state.confirmed = confirmed
        state.status = SessionStatus.APPLIED if confirmed else SessionStatus.REJECTED
        return state


def _token(settings: Settings) -> str:
    import jwt

    return jwt.encode(
        {"sub": "u1", "username": "t", "role": "admin"},
        settings.auth_jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


def _client(runner: _MockRunner | None = None):
    from fastapi.testclient import TestClient

    app = create_app(settings=_settings())
    if runner is not None:
        from app.api.ai_deps import get_agent_runner

        app.dependency_overrides[get_agent_runner] = lambda: runner
    return TestClient(app)


def _parse_sse(text: str) -> list[dict[str, Any]]:
    """解析 SSE 文本为 [{event, data}] 列表（与 engine api/ai.ts 解析逻辑一致）。

    兼容 LF / CRLF 行尾与帧分隔（sse-starlette 在不同环境输出不同）。
    """
    # 归一化行尾为 LF，再按空行（一个或多个）分帧
    norm = text.replace("\r\n", "\n")
    frames = re.split(r"\n\n+", norm)
    out = []
    for frame in frames:
        if not frame.strip():
            continue
        ev = "message"
        data: Any = None
        for line in frame.split("\n"):
            if line.startswith("event:"):
                ev = line[6:].strip()
            elif line.startswith("data:"):
                raw = line[5:].strip()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    data = raw
        if data is not None:
            out.append({"event": ev, "data": data})
    return out


# ===== 契约：事件名与字段 =====


def test_sse_progress_event_contract() -> None:
    """progress 事件含 type/message（engine progressLabel 消费）。"""
    schema = PageSchema(root=NodeSchema(id="r", type="LubanPage"))
    c = _client(_MockRunner(schema))
    resp = c.post(
        "/ai/chat",
        json={"message": "x"},
        headers=_bff_headers(),
    )
    events = _parse_sse(resp.text)
    progress = [e for e in events if e["event"] == "progress"]
    assert len(progress) >= 1
    assert "type" in progress[0]["data"]
    assert "message" in progress[0]["data"]


def test_sse_confirm_event_contract() -> None:
    """confirm 事件含 type/session_id/schema（engine onConfirm 消费）。"""
    schema = PageSchema(
        root=NodeSchema(
            id="r",
            type="LubanPage",
            children=[NodeSchema(id="b", type="LubanButton", props={"label": "ok"})],
        )
    )
    c = _client(_MockRunner(schema))
    resp = c.post(
        "/ai/chat",
        json={"message": "x"},
        headers=_bff_headers(),
    )
    events = _parse_sse(resp.text)
    confirms = [e for e in events if e["event"] == "confirm"]
    assert len(confirms) == 1
    data = confirms[0]["data"]
    # engine routeEvent 读这些字段
    assert data["type"] == "confirm"
    assert "session_id" in data
    assert data["schema"] is not None
    assert data["schema"]["root"]["type"] == "LubanPage"


def test_sse_error_event_contract() -> None:
    """failed 终态产 error 事件含 type/message（engine onError 消费）。"""

    class FailRunner:
        async def run(self, state: AgentState) -> AgentState:
            state.status = SessionStatus.FAILED
            state.error = "校验失败超限"
            return state

        async def resume_after_confirm(self, state: AgentState, confirmed: bool) -> AgentState:
            return state

    c = _client(FailRunner())  # type: ignore[arg-type]
    resp = c.post(
        "/ai/chat",
        json={"message": "x"},
        headers=_bff_headers(),
    )
    events = _parse_sse(resp.text)
    errors = [e for e in events if e["event"] == "error"]
    assert len(errors) == 1
    assert errors[0]["data"]["type"] == "error"
    assert "message" in errors[0]["data"]


# ===== 契约：JWT 鉴权链路 =====


def test_contract_requires_valid_jwt() -> None:
    """engine 客户端带 Bearer JWT，服务端必须验签（缺/无效 → 401）。"""
    c = _client(_MockRunner(PageSchema(root=NodeSchema(id="r", type="LubanPage"))))
    # 无 token
    assert c.post("/ai/chat", json={"message": "x"}).status_code == 401
    # 无效 token
    resp = c.post(
        "/ai/chat", json={"message": "x"}, headers={"X-User-Id": "u"}
    )
    assert resp.status_code == 401


# ===== 契约：schema 字段名与 engine NodeSchema 对齐 =====


def test_schema_field_names_align_engine() -> None:
    """AI 服务产出的 schema 字段名须与 engine NodeSchema(id/type/props/children) 一致。

    eventBindings：AI 服务 Pydantic 用 alias events/eventBindings，engine 8905b38 用 eventBindings。
    本测试锁定：confirm.schema.root 的字段名 = engine 消费的字段名。
    """
    schema = PageSchema(
        root=NodeSchema(
            id="r",
            type="LubanPage",
            props={"bg": "#fff"},
            children=[NodeSchema(id="b", type="LubanButton", props={"label": "x"})],
        )
    )
    c = _client(_MockRunner(schema))
    resp = c.post(
        "/ai/chat",
        json={"message": "x"},
        headers=_bff_headers(),
    )
    events = _parse_sse(resp.text)
    confirm = next(e for e in events if e["event"] == "confirm")
    root = confirm["data"]["schema"]["root"]
    # engine NodeSchema 必需字段
    assert root["id"] == "r"
    assert root["type"] == "LubanPage"
    assert root["props"] == {"bg": "#fff"}
    assert isinstance(root["children"], list) and len(root["children"]) == 1
