"""P1-T6 API 端点单测：SSE 流式 + JWT 鉴权 + FeatureGate。

JWT 用 settings.auth_jwt_secret 签发测试 token（不依赖 luban 真实密钥）。
AgentRunner 经 dependency_overrides 替换为可控 mock（不依赖真实 LLM）。
"""

from __future__ import annotations

from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.agent.state import AgentState, SessionStatus
from app.core.config import ModelProvider, Settings
from app.main import create_app
from app.schemas.page_schema import NodeSchema, PageSchema


def _settings(**over: Any) -> Settings:
    base = dict(
        environment="test",
        model_provider=ModelProvider.GLM,
        auth_jwt_secret=SecretStr("test-jwt-secret"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
    )
    base.update(over)
    return Settings(**base)


def _token(settings: Settings, *, sub: str = "user1", expired: bool = False) -> str:
    import time

    payload = {"sub": sub, "username": "tester", "role": "admin"}
    if expired:
        payload["exp"] = int(time.time()) - 3600
    return jwt.encode(payload, settings.auth_jwt_secret.get_secret_value(), algorithm="HS256")


class MockRunner:
    """可控 mock：run 后把 state 推到给定终态。"""

    def __init__(self, final_status: SessionStatus, schema: PageSchema | None = None) -> None:
        self._final = final_status
        self._schema = schema
        self.captured_states: list[AgentState] = []

    async def run(self, state: AgentState) -> AgentState:
        state.add_progress("progress", message="正在生成…")
        state.add_progress("tool", tool="generate", ok=True)
        state.generated_schema = self._schema
        state.status = self._final
        if self._final == SessionStatus.AWAITING_CONFIRM:
            state.interrupted = True
        elif self._final == SessionStatus.FAILED:
            state.error = "校验失败"
        self.captured_states.append(state)
        return state

    async def resume_after_confirm(self, state: AgentState, confirmed: bool) -> AgentState:
        state.confirmed = confirmed
        state.status = SessionStatus.APPLIED if confirmed else SessionStatus.REJECTED
        return state


def _client(
    settings: Settings,
    runner: MockRunner | None = None,
) -> TestClient:
    app = create_app(settings=settings)
    if runner is not None:
        from app.api.ai_deps import get_agent_runner

        app.dependency_overrides[get_agent_runner] = lambda: runner
    return TestClient(app)


def _good_schema() -> PageSchema:
    return PageSchema(
        root=NodeSchema(
            id="root",
            type="LubanPage",
            children=[NodeSchema(id="b", type="LubanButton", props={"label": "提交"})],
        )
    )


# ===== JWT 鉴权 =====


def test_chat_without_token_returns_401() -> None:
    settings = _settings()
    with _client(settings) as c:
        resp = c.post("/ai/chat", json={"message": "做一个页面"})
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHENTICATED"


def test_chat_with_invalid_token_returns_401() -> None:
    settings = _settings()
    with _client(settings) as c:
        resp = c.post(
            "/ai/chat",
            json={"message": "x"},
            headers={"Authorization": "Bearer not.a.valid.token"},
        )
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHENTICATED"


def test_chat_with_expired_token_returns_401() -> None:
    settings = _settings()
    with _client(settings) as c:
        resp = c.post(
            "/ai/chat",
            json={"message": "x"},
            headers={"Authorization": f"Bearer {_token(settings, expired=True)}"},
        )
    assert resp.status_code == 401
    body = resp.json()
    assert body["code"] == "UNAUTHENTICATED"
    assert body["details"]["reason"] == "expired"


# ===== SSE 流式（chat）=====


def test_chat_streams_confirm_event() -> None:
    settings = _settings()
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM, schema=_good_schema())
    with _client(settings, runner) as c:
        resp = c.post(
            "/ai/chat",
            json={"message": "做一个提交按钮页", "siteId": "s1", "pageId": "p1"},
            headers={"Authorization": f"Bearer {_token(settings)}"},
        )
    assert resp.status_code == 200
    text = resp.text
    # 含 progress / tool / confirm 事件
    assert "event: progress" in text or '"type":"progress"' in text
    assert "event: confirm" in text
    assert '"session_id"' in text
    # mock runner 收到正确 user_id（鉴权链路通）
    assert runner.captured_states[0].user_id == "user1"
    assert runner.captured_states[0].site_id == "s1"


def test_chat_streams_error_on_failed() -> None:
    settings = _settings()
    runner = MockRunner(SessionStatus.FAILED)
    with _client(settings, runner) as c:
        resp = c.post(
            "/ai/chat",
            json={"message": "x"},
            headers={"Authorization": f"Bearer {_token(settings)}"},
        )
    assert resp.status_code == 200
    assert "event: error" in resp.text
    assert "校验失败" in resp.text


# ===== generate + FeatureGate =====


def test_generate_returns_503_when_disabled() -> None:
    settings = _settings(ai_generate_enabled=False)
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM)
    with _client(settings, runner) as c:
        resp = c.post(
            "/ai/generate",
            json={"prompt": "x"},
            headers={"Authorization": f"Bearer {_token(settings)}"},
        )
    assert resp.status_code == 503
    assert resp.json()["code"] == "AI_FEATURE_DISABLED"


def test_generate_streams_when_enabled() -> None:
    settings = _settings(ai_generate_enabled=True)
    runner = MockRunner(SessionStatus.AWAITING_CONFIRM, schema=_good_schema())
    with _client(settings, runner) as c:
        resp = c.post(
            "/ai/generate",
            json={"prompt": "做一个表格页"},
            headers={"Authorization": f"Bearer {_token(settings)}"},
        )
    assert resp.status_code == 200
    assert "event: confirm" in resp.text


# ===== config / health 仍可用（回归）=====


def test_config_still_works() -> None:
    settings = _settings()
    with _client(settings) as c:
        resp = c.get("/ai/config")
    assert resp.status_code == 200
    assert resp.json()["model"]["provider"] == "glm"


# ===== JWT decode 细节 =====


def test_decode_token_missing_sub_rejected() -> None:
    from app.auth.jwt import decode_token

    settings = _settings()
    bad = jwt.encode(
        {"username": "x"}, settings.auth_jwt_secret.get_secret_value(), algorithm="HS256"
    )
    with pytest.raises(Exception):
        decode_token(bad, settings)


def test_decode_token_extracts_user() -> None:
    from app.auth.jwt import AuthUser, decode_token

    settings = _settings()
    user = decode_token(_token(settings, sub="u42"), settings)
    assert isinstance(user, AuthUser)
    assert user.user_id == "u42"
    assert user.username == "tester"
    assert user.role == "admin"
