"""模型配置只读端点。

GET /ai/config → {model:{provider,name}, features:{generate,guidance}}

前端只读展示当前部署模型（Q6 全局切换，不开放用户选）。
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.config import Settings

router = APIRouter(prefix="/config", tags=["config"])


def _provider_model_name(settings: Settings) -> str:
    p = settings.model_provider.value
    mapping = {
        "glm": settings.glm_model,
        "deepseek": settings.deepseek_model,
        "tongyi": settings.qwen_model,
    }
    return mapping.get(p, "unknown")


@router.get("")
async def get_config(request: Request) -> dict[str, object]:
    settings = request.app.state.settings
    return {
        "model": {
            "provider": settings.model_provider.value,
            "name": _provider_model_name(settings),
        },
        "features": {
            "generate": settings.ai_generate_enabled,
            "guidance": settings.ai_guidance_enabled,
        },
    }
