"""pytest 公共夹具。

各测试模块自带 `settings` fixture（按需覆盖 provider 等）；
此处仅提供 `app_client`，消费 `settings` 建 FastAPI TestClient。
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """隔离环境变量,防止本地 .env 污染测试(AI_SERVICE_TOKEN/AUTH_JWT_SECRET 等)。

    测试通过 settings fixture 显式注入配置,不依赖运行环境的 .env。
    """
    for key in (
        "AI_SERVICE_TOKEN",
        "AUTH_JWT_SECRET",
        "MODEL_PROVIDER",
        "DEEPSEEK_API_KEY",
        "GLM_API_KEY",
        "QWEN_API_KEY",
        "ENABLE_STARTUP_SYNC",
    ):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def app_client(request: pytest.FixtureRequest) -> Iterator[object]:
    """FastAPI TestClient（用同会话的 settings fixture 注入）。

    依赖同模块/会话注入的 `settings` fixture（测试模块自定义）。
    """
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = request.getfixturevalue("settings")
    app = create_app(settings=settings)
    with TestClient(app) as client:
        yield client
