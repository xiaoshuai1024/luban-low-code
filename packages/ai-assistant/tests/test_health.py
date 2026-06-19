"""P1-T1 骨架冒烟：healthz / config 端点可达，应用工厂可建。"""

from __future__ import annotations

import pytest
from pydantic import SecretStr

from app.api.errors import ApiError, UnauthenticatedError
from app.core.config import ModelProvider, Settings
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        auth_jwt_secret=SecretStr("test-jwt-secret"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
        langfuse_public_key=SecretStr("k"),
        langfuse_secret_key=SecretStr("k"),
    )


def test_app_factory_creates_app(settings: Settings) -> None:
    from fastapi.testclient import TestClient

    app = create_app(settings=settings)
    assert app.title == "luban-ai-assistant"
    # 通过 HTTP 验证 health + ai/config 路由实际挂载可达（比遍历 app.routes 更稳）
    with TestClient(app) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/ai/config").status_code == 200


def test_healthz_ok(app_client) -> None:  # type: ignore[no-untyped-def]
    resp = app_client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert set(body["deps"]) == {"postgres", "milvus", "minio", "langfuse"}


def test_config_endpoint_exposes_provider(settings: Settings, app_client) -> None:  # type: ignore[no-untyped-def]
    resp = app_client.get("/ai/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"]["provider"] == settings.model_provider.value
    assert body["model"]["name"] == "glm-4"  # 默认 glm
    assert body["features"] == {"generate": True, "guidance": True}


def test_config_endpoint_reflects_provider_switch(settings: Settings) -> None:
    from fastapi.testclient import TestClient

    s = settings.model_copy(update={"model_provider": ModelProvider.DEEPSEEK})
    app = create_app(settings=s)
    with TestClient(app) as client:
        body = client.get("/ai/config").json()
    assert body["model"]["provider"] == "deepseek"
    assert body["model"]["name"] == "deepseek-chat"


def test_error_model_serializes() -> None:
    err = UnauthenticatedError("bad token", details={"reason": "expired"})
    assert err.status_code == 401
    assert err.to_body() == {
        "code": "UNAUTHENTICATED",
        "message": "bad token",
        "details": {"reason": "expired"},
    }
    assert isinstance(err, ApiError)
