"""storage/minio.py — MinIO 图片存储（plan P2-T1）。

设计稿图片上传/下载/presigned 访问 + 类型/大小校验白名单。
bucket 复用 P1 预建的 `ai-assets`；图片 key 规则 `designs/{userId}/{jobId}.{ext}`。

访问控制（plan P2 安全）：私有 bucket，presigned URL 限时访问；
GET /ai/assets/{key} 按 job.user_id 鉴权（仅 owner 可访问）。

测试：用 fake client 注入，不依赖真实 MinIO。
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Any

from app.api.errors import InvalidImageError
from app.core.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class StoredImage:
    """上传后的图片元信息。"""

    key: str  # MinIO object key（designs/{userId}/{jobId}.{ext}）
    url: str  # presigned GET URL（限时）
    size: int
    content_type: str


# MIME → 扩展名映射（key 命名用）
_EXT_BY_MIME = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def validate_image(data: bytes, content_type: str, settings: Settings) -> None:
    """图片白名单校验：类型 + 大小。非法 → 400 INVALID_IMAGE。"""
    if content_type not in settings.design_image_allowed_types:
        raise InvalidImageError(
            f"不支持的图片类型: {content_type}",
            details={"allowed": settings.design_image_allowed_types},
        )
    if len(data) > settings.design_image_max_bytes:
        raise InvalidImageError(
            f"图片过大: {len(data)} bytes > {settings.design_image_max_bytes}",
            details={"max_bytes": settings.design_image_max_bytes},
        )


def make_image_key(user_id: str, job_id: str, content_type: str) -> str:
    """图片 key 规则：designs/{userId}/{jobId}.{ext}（按 user 隔离）。"""
    ext = _EXT_BY_MIME.get(content_type, "bin")
    return f"designs/{user_id}/{job_id}.{ext}"


class ImageStore:
    """MinIO 图片存储（懒连接，测试可注入 fake client）。

    生产用 minio.Minio；测试注入 _client 为 mock 对象（实现 put_object/get_presigned_url）。
    """

    def __init__(self, settings: Settings, client: object | None = None) -> None:
        self.settings = settings
        self._client: Any = client
        self._bucket = settings.minio_bucket

    def _ensure_client(self) -> Any:
        """懒构造 minio.Minio 客户端（避免 import 期建连）。"""
        if self._client is not None:
            return self._client
        from minio import Minio

        endpoint = self.settings.minio_endpoint
        self._client = Minio(
            endpoint=endpoint,
            access_key=self.settings.minio_access_key,
            secret_key=self.settings.minio_secret_key.get_secret_value(),
            secure=self.settings.minio_secure,
        )
        self._ensure_bucket()
        return self._client

    def _ensure_bucket(self) -> None:
        """幂等建 bucket（不存在则创建）。client 已由 _ensure_client 构造（非 None）。"""
        client = self._client
        try:
            if not client.bucket_exists(self._bucket):
                client.make_bucket(self._bucket)
                logger.info("已创建 MinIO bucket: %s", self._bucket)
        except Exception as e:
            # bucket 创建失败不阻断（可能已存在或权限问题，后续 put 会暴露真错）
            logger.warning("bucket 检查/创建失败（可能已存在）: %s", e)

    def upload(self, *, user_id: str, job_id: str, data: bytes, content_type: str) -> StoredImage:
        """上传图片 → 返回 key + presigned URL。调用方应先 validate_image。"""
        validate_image(data, content_type, self.settings)
        key = make_image_key(user_id, job_id, content_type)
        client = self._ensure_client()
        from minio.error import S3Error

        try:
            client.put_object(
                bucket_name=self._bucket,
                object_name=key,
                data=io.BytesIO(data),
                length=len(data),
                content_type=content_type,
            )
        except S3Error as e:
            logger.error("MinIO 上传失败: %s", e)
            raise
        url = self.presigned_get(key)
        return StoredImage(key=key, url=url, size=len(data), content_type=content_type)

    def presigned_get(self, key: str) -> str:
        """生成限时 presigned GET URL。"""
        client = self._ensure_client()
        from datetime import timedelta

        from minio.error import S3Error

        try:
            url = client.presigned_get_object(
                bucket_name=self._bucket,
                object_name=key,
                expires=timedelta(seconds=self.settings.design_presigned_expiry),
            )
            return str(url)
        except S3Error as e:
            logger.error("presigned 生成失败: %s", e)
            raise

    def get_object(self, key: str) -> bytes:
        """下载图片字节（用于代理访问 /ai/assets/{key}）。"""
        client = self._ensure_client()
        response = client.get_object(self._bucket, key)
        try:
            data: bytes = response.read()
            return data
        finally:
            response.close()
            response.release_conn()


__all__ = ["ImageStore", "StoredImage", "make_image_key", "validate_image"]
