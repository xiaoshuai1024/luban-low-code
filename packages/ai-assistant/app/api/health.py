"""健康检查端点。

GET /healthz → {status, deps:{postgres, qdrant, llm}}

依赖探测 lazy(首次调用连一次),避免 import 期建连。
任一关键依赖不可达返回 503 + degraded。
M2 迁移:删除 milvus/minio/langfuse 探测,新增 qdrant 真实探活。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request, Response

from app.core.config import Settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


async def _probe_postgres(settings: Settings) -> bool:
    """骨架阶段仅校验配置存在;真实探活(checkpoint 接入后)用 asyncpg SELECT 1。"""
    return bool(settings.postgres_dsn)


async def _probe_qdrant(settings: Settings) -> bool:
    """Qdrant 真实探活:GET / 返回 ok 即可达。lazy(仅 healthz 调用时连)。"""
    try:
        import httpx

        async with httpx.AsyncClient(trust_env=False, timeout=2.0) as client:
            # trust_env=False 避免 macOS 系统代理拦截 localhost
            resp = await client.get(
                f"http://{settings.qdrant_host}:{settings.qdrant_port}/healthz"
            )
            return resp.status_code == 200
    except Exception as e:
        logger.debug("qdrant probe failed: %s", e)
        return False


async def _probe_llm(settings: Settings) -> bool:
    """LLM 配置存在性检查(不真实调用,避免 healthz 触发 token 消费)。"""
    provider = settings.model_provider.value
    key_map = {"glm": "glm_api_key", "deepseek": "deepseek_api_key", "tongyi": "qwen_api_key"}
    key_field = key_map.get(provider)
    if not key_field:
        return False
    val = getattr(settings, key_field, None)
    return bool(val and val.get_secret_value())


@router.get("/healthz")
async def healthz(request: Request, response: Response) -> dict[str, object]:
    settings: Settings = request.app.state.settings
    deps = {
        "postgres": await _probe_postgres(settings),
        "qdrant": await _probe_qdrant(settings),
        "llm": await _probe_llm(settings),
    }
    ok = all(deps.values())
    if not ok:
        response.status_code = 503
    return {"status": "ok" if ok else "degraded", "deps": deps}
