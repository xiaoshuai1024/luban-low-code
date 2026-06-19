"""健康检查端点。

GET /healthz → {status, deps:{postgres,milvus,minio,langfuse}}

依赖探测 lazy（首次调用连一次），避免 import 期建连。
任一依赖不可达返回 503 + degraded。
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.core.config import Settings

router = APIRouter(tags=["health"])


async def _probe_postgres(settings: Settings) -> bool:
    # P1-T1：骨架阶段仅校验配置存在；真实探活在 P1-T5/T6 接入 asyncpg 后启用
    return bool(settings.postgres_dsn)


async def _probe_milvus(settings: Settings) -> bool:
    return bool(settings.milvus_host)


async def _probe_minio(settings: Settings) -> bool:
    return bool(settings.minio_endpoint)


async def _probe_langfuse(settings: Settings) -> bool:
    return bool(settings.langfuse_host)


@router.get("/healthz")
async def healthz(request: Request, response: Response) -> dict[str, object]:
    settings: Settings = request.app.state.settings
    deps = {
        "postgres": await _probe_postgres(settings),
        "milvus": await _probe_milvus(settings),
        "minio": await _probe_minio(settings),
        "langfuse": await _probe_langfuse(settings),
    }
    ok = all(deps.values())
    if not ok:
        response.status_code = 503
    return {"status": "ok" if ok else "degraded", "deps": deps}
