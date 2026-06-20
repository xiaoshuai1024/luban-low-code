"""luban-ai-assistant FastAPI 入口。

路由前缀 /ai。鉴权：全 Authorization: Bearer <luban JWT>（AI 服务自验）。
错误体对齐 luban 风格 {code, message, details?}。

P1-T1 仅挂健康检查 + 模型配置只读端点；流式/agent 端点在 P1-T6 接入。
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import config as config_api
from app.api import health as health_api
from app.api.assets import router as assets_router
from app.api.chat import router as chat_router
from app.api.design import router as design_router
from app.api.errors import ApiError
from app.api.guidance import router as guidance_router
from app.api.ws import router as ws_router
from app.core.config import Settings, get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # P1-T1：无启动期重连接（lazy）；各模块在首次调用时建连。
    yield


def create_app(settings: Settings | None = None) -> FastAPI:
    """应用工厂（测试可直接注入 settings，不读环境变量）。"""
    s = settings or get_settings()
    app = FastAPI(
        title="luban-ai-assistant",
        version="0.1.0",
        description="Luban AI 助手 — 自然语言生成/编辑页面 + 引导 + 模型切换",
        lifespan=lifespan,
    )
    app.state.settings = s

    # CORS（前端直连 AI 服务）
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 统一错误处理：ApiError 子类 → {code, message, details}
    @app.exception_handler(ApiError)
    async def _handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_body())

    app.include_router(health_api.router)
    app.include_router(config_api.router, prefix="/ai")
    app.include_router(chat_router)  # 已带 /ai 前缀
    app.include_router(ws_router)  # WS /ai/agent
    app.include_router(guidance_router)  # GET /ai/guidance
    app.include_router(design_router)  # POST /ai/design-to-page（plan P2）
    app.include_router(assets_router)  # GET /ai/assets/{key}（plan P2）

    return app


app = create_app()
