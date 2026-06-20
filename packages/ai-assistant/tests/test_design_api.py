"""P2-T3 设计稿转页面 API 端点单测（plan P2）。

multipart 上传 + SSE 流式 + JWT 鉴权 + 图片白名单 + FeatureGate。
mock _build_design_runner 注入可控 DesignRunner。
"""

from __future__ import annotations

from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.agent.design_nodes import DesignState
from app.agent.state import SessionStatus
from app.core.config import Settings
from app.main import create_app
from app.schemas.page_schema import NodeSchema, PageSchema


def _settings(**over: Any) -> Settings:
    base = dict(
        environment="test",
        auth_jwt_secret=SecretStr("test-jwt-secret"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
        langfuse_public_key=SecretStr("k"),
        langfuse_secret_key=SecretStr("k"),
    )
    base.update(over)
    return Settings(**base)


def _token(settings: Settings, sub: str = "user1") -> str:
    payload = {"sub": sub, "username": "tester", "role": "admin"}
    return jwt.encode(payload, settings.auth_jwt_secret.get_secret_value(), algorithm="HS256")


class _MockDesignRunner:
    """可控 mock：run 后推到 awaiting_confirm + 填 generated_schema。"""

    def __init__(
        self,
        schema: PageSchema | None = None,
        status: SessionStatus = SessionStatus.AWAITING_CONFIRM,
    ) -> None:
        self._schema = schema or PageSchema(
            root=NodeSchema(
                id="root", type="LubanPage", children=[NodeSchema(id="t", type="LubanTable")]
            )
        )
        self._status = status

    async def run(self, state: DesignState) -> DesignState:
        state.add_progress("progress", message="理解中…")
        state.add_progress("tool", tool="understand_image", result="2 组件")
        state.generated_schema = self._schema
        state.status = self._status
        if self._status == SessionStatus.AWAITING_CONFIRM:
            state.add_progress("confirm", message="等待确认")
        return state


class _FakeImageStore:
    """fake ImageStore：upload 返回固定 key/url，不连真实 MinIO。"""

    def upload(self, **kw: object) -> object:
        from app.storage.minio import StoredImage

        return StoredImage(
            key=f"designs/{kw['user_id']}/{kw['job_id']}.png",
            url="http://fake/presigned",
            size=len(kw["data"]),  # type: ignore[arg-type]
            content_type=kw["content_type"],  # type: ignore[arg-type]
        )

    def get_object(self, key: str) -> bytes:
        return b"fake"


def _patch_image_store(monkeypatch: pytest.MonkeyPatch) -> None:
    """替换 design 端点用的 ImageStore 为 fake（避免真实 MinIO 建连）。"""
    from app.api import design as design_api

    monkeypatch.setattr(design_api, "ImageStore", lambda settings: _FakeImageStore())


def _client(settings: Settings, runner: _MockDesignRunner | None = None) -> TestClient:
    app = create_app(settings=settings)
    if runner is not None:
        from app.api import design as design_api

        app.dependency_overrides[design_api.get_design_runner] = lambda: runner
    return TestClient(app)


def _png_bytes() -> bytes:
    # 最小合法 PNG 签名（validate_image 不校验内容，只看 mime+大小）
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


def test_design_to_page_streams_confirm(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_image_store(monkeypatch)
    settings = _settings()
    runner = _MockDesignRunner()
    token = _token(settings)
    client = _client(settings, runner)
    resp = client.post(
        "/ai/design-to-page",
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("test.png", _png_bytes(), "image/png")},
        data={"siteId": "s1", "pageId": "p1"},
    )
    assert resp.status_code == 200
    body = resp.text
    # SSE 应含 progress 和终态 confirm（带 schema）。JSON 序列化带空格，用 type+confirm 宽松匹配
    assert "uploaded" in body
    assert '"confirm"' in body
    assert "schema" in body


def test_design_to_page_401_without_token() -> None:
    settings = _settings()
    client = _client(settings)
    resp = client.post(
        "/ai/design-to-page",
        files={"image": ("t.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 401


def test_design_to_page_rejects_bad_image_type() -> None:
    settings = _settings()
    token = _token(settings)
    client = _client(settings)
    resp = client.post(
        "/ai/design-to-page",
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("t.gif", b"GIF89a", "image/gif")},
    )
    assert resp.status_code == 400


def test_design_to_page_503_when_disabled() -> None:
    settings = _settings(ai_design_to_page_enabled=False)
    token = _token(settings)
    client = _client(settings)
    resp = client.post(
        "/ai/design-to-page",
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("t.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 503


def test_design_to_page_failed_status_emits_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_image_store(monkeypatch)
    settings = _settings()
    runner = _MockDesignRunner(status=SessionStatus.FAILED)
    token = _token(settings)
    client = _client(settings, runner)
    resp = client.post(
        "/ai/design-to-page",
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("t.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 200
    assert '"error"' in resp.text


def test_assets_endpoint_403_cross_user() -> None:
    """跨用户访问图片 → 403（多租户隔离 plan P2 安全）。"""
    settings = _settings()
    _token(settings, sub="owner")
    other_token = _token(settings, sub="other")
    client = _client(settings)
    # other 访问 owner 的图片
    resp = client.get(
        "/ai/assets/designs/owner/job-1.png",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 403
