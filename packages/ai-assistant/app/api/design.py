"""api/design.py — 设计稿转页面端点（plan P2-T3）。

POST /ai/design-to-page（multipart/form-data + SSE 流式）：
  req {image: File, siteId?, pageId?, context?}
  → 验 JWT + 图片白名单 → MinIO 存原图 → DesignRunner.run
  → SSE 流式：uploaded → understanding → generating → patch/confirm → done/error

鉴权：Authorization: Bearer <luban JWT>。
FeatureGate ai.design_to_page 关 → 503。
图片非法（非图/超大）→ 400 INVALID_IMAGE。
错误体复用 P1 {code, message, details?}。
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agent.design_graph import DesignRunner
from app.agent.design_nodes import DesignState
from app.agent.state import SessionStatus
from app.api.ai_deps import get_agent_deps
from app.api.errors import FeatureDisabledError
from app.auth.jwt import AuthUser, get_current_user
from app.core.config import Settings
from app.llm.multimodal import vision_model_info
from app.storage.minio import ImageStore, validate_image

router = APIRouter(prefix="/ai", tags=["ai-design"])


def _sse(event: dict[str, Any]) -> str:
    return json.dumps(event, ensure_ascii=False, default=str)


class DesignSseRequest(BaseModel):
    """multipart 表单的 JSON 字段契约（文档用，实际走 Form）。"""

    site_id: str | None = None
    page_id: str | None = None
    context: dict[str, Any] | None = None


def _build_design_runner(settings: Settings, image_store: ImageStore | None = None) -> DesignRunner:
    """构造 DesignRunner（复用 agent deps 的 provider/registry）。"""
    from app.agent.design_nodes import DesignDeps

    deps = get_agent_deps(settings)
    store = image_store or ImageStore(settings)
    design_deps = DesignDeps(provider=deps.provider, image_store=store, registry=deps.registry)
    return DesignRunner(design_deps)


def get_design_runner(request: Request) -> DesignRunner:
    """FastAPI 依赖：返回 DesignRunner（测试可 dependency_overrides 替换为 mock）。"""
    settings: Settings = request.app.state.settings
    return _build_design_runner(settings)


def _store_uploaded_image(
    settings: Settings, user_id: str, job_id: str, data: bytes, content_type: str
) -> tuple[str, str]:
    """上传图片到 MinIO，返回 (key, presigned_url)。独立函数便于测试 monkeypatch。"""
    store = ImageStore(settings)
    stored = store.upload(user_id=user_id, job_id=job_id, data=data, content_type=content_type)
    return stored.key, stored.url


async def _stream_design(runner: DesignRunner, state: DesignState) -> EventSourceResponse:
    """跑 design workflow 并流式回传 progress → 终态事件（复用 chat._stream_agent 模式）。"""

    async def event_gen() -> AsyncGenerator[dict[str, str], None]:
        sent = 0
        task = asyncio.create_task(runner.run(state))
        while not task.done():
            for ev in state.progress[sent:]:
                yield {"event": ev.get("type", "progress"), "data": _sse(ev)}
                sent += 1
            await asyncio.sleep(0.02)
        for ev in state.progress[sent:]:
            yield {"event": ev.get("type", "progress"), "data": _sse(ev)}

        # 终态事件
        if state.status == SessionStatus.AWAITING_CONFIRM:
            yield {
                "event": "confirm",
                "data": _sse(
                    {
                        "type": "confirm",
                        "session_id": state.job_id,
                        "schema": state.generated_schema.model_dump(by_alias=True)
                        if state.generated_schema
                        else None,
                    }
                ),
            }
        elif state.status == SessionStatus.FAILED:
            yield {
                "event": "error",
                "data": _sse({"type": "error", "message": state.error or "设计稿理解失败"}),
            }
        else:
            yield {"event": "done", "data": _sse({"type": "done", "status": state.status.value})}

    return EventSourceResponse(event_gen())


@router.post("/design-to-page")
async def design_to_page(
    request: Request,
    image: UploadFile = File(...),
    site_id: str | None = Form(default=None, alias="siteId"),
    page_id: str | None = Form(default=None, alias="pageId"),
    context_json: str | None = Form(default=None, alias="context"),
    user: AuthUser = Depends(get_current_user),
    runner: DesignRunner = Depends(get_design_runner),
) -> EventSourceResponse:
    """设计稿转页面（multipart + SSE）。"""
    settings: Settings = request.app.state.settings
    if not settings.ai_design_to_page_enabled:
        raise FeatureDisabledError("ai.design_to_page 未启用")

    # 读图 + 白名单校验
    raw = await image.read()
    content_type = image.content_type or "application/octet-stream"
    validate_image(raw, content_type, settings)  # 非法 → 400 INVALID_IMAGE

    # 存 MinIO（按 user 隔离）
    job_id = uuid.uuid4().hex
    image_key, image_url = _store_uploaded_image(settings, user.user_id, job_id, raw, content_type)

    context: dict[str, Any] = {}
    if context_json:
        try:
            context = json.loads(context_json)
        except json.JSONDecodeError:
            context = {}

    vinfo = vision_model_info(settings)
    state = DesignState(
        job_id=job_id,
        user_id=user.user_id,
        site_id=site_id,
        page_id=page_id,
        image_key=image_key,
        image_bytes=raw,
        image_mime=content_type,
        user_prompt=str(context.get("prompt", "")),
        model_provider=vinfo.provider,
        model_name=vinfo.model,
    )
    state.add_progress("uploaded", key=image_key, url=image_url)

    return await _stream_design(runner, state)
