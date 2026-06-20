"""api/assets.py — 设计稿图片访问端点（plan P2-T3）。

GET /ai/assets/{key}：
  按 job.user_id 鉴权（仅 owner 可访问，plan P2 安全），
  返回 presigned URL 重定向 或 代理图片字节。

key 规则 designs/{userId}/{jobId}.{ext}：从中解析 userId 与当前 user 比对。
非法访问（跨用户）→ 403。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response

from app.auth.jwt import AuthUser, get_current_user
from app.core.config import Settings
from app.storage.minio import ImageStore

router = APIRouter(prefix="/ai/assets", tags=["ai-assets"])


def _parse_user_from_key(key: str) -> str | None:
    """从 key designs/{userId}/{jobId}.{ext} 提取 userId。"""
    parts = key.split("/")
    if len(parts) >= 2 and parts[0] == "designs":
        return parts[1]
    return None


@router.get("/{key:path}")
async def get_asset(
    key: str,
    request: Request,
    user: AuthUser = Depends(get_current_user),
) -> Response:
    """按 owner 鉴权访问图片：返回 presigned 重定向，或代理字节。"""
    settings: Settings = request.app.state.settings
    key_user = _parse_user_from_key(key)
    # 跨用户访问 → 403（多租户隔离 plan P2 安全）
    if key_user is not None and key_user != user.user_id:
        raise HTTPException(status_code=403, detail="无权访问该资源")

    store = ImageStore(settings)
    # 默认重定向到 presigned URL（限时）；若需代理（隐藏 MinIO）可降级为字节流
    redirect = request.query_params.get("redirect", "true").lower() != "false"
    if redirect:
        url = store.presigned_get(key)
        return RedirectResponse(url=url)
    data = store.get_object(key)
    return Response(content=data, media_type="application/octet-stream")
