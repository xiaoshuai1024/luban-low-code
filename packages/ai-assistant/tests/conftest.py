"""pytest 公共夹具。

各测试模块自带 `settings` fixture（按需覆盖 provider 等）；
此处仅提供 `app_client`，消费 `settings` 建 FastAPI TestClient。
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest


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
