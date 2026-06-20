"""P2-T1 MinIO 图片存储单测（plan P2）。

用 fake MinIO client 注入，不依赖真实 MinIO。
覆盖：validate_image 白名单、make_image_key 隔离、upload/presigned_get/get_object。
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import SecretStr

from app.api.errors import InvalidImageError
from app.core.config import Settings
from app.storage.minio import ImageStore, make_image_key, validate_image


def _settings(**over: Any) -> Settings:
    base = dict(
        environment="test",
        auth_jwt_secret=SecretStr("k"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
    )
    base.update(over)
    return Settings(**base)


class FakeMinioClient:
    """记录调用 + 内存存对象的 fake MinIO。"""

    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}
        self.created_buckets: set[str] = set()

    def bucket_exists(self, name: str) -> bool:
        return name in self.created_buckets

    def make_bucket(self, name: str) -> None:
        self.created_buckets.add(name)

    def put_object(
        self, bucket_name: str, object_name: str, data: Any, length: int, content_type: str
    ) -> None:
        self.objects[(bucket_name, object_name)] = data.read()

    def presigned_get_object(self, bucket_name: str, object_name: str, expires: Any) -> str:
        return f"http://fake/{bucket_name}/{object_name}?expires={expires}"

    def get_object(self, bucket_name: str, object_name: str) -> Any:
        data = self.objects.get((bucket_name, object_name), b"")
        return _FakeResponse(data)


class _FakeResponse:
    def __init__(self, data: bytes) -> None:
        self._data = data

    def read(self) -> bytes:
        return self._data

    def close(self) -> None:
        pass

    def release_conn(self) -> None:
        pass


def test_validate_image_accepts_png() -> None:
    validate_image(b"x" * 100, "image/png", _settings())  # 不抛即通过


def test_validate_image_rejects_bad_type() -> None:
    with pytest.raises(InvalidImageError):
        validate_image(b"x", "image/gif", _settings())


def test_validate_image_rejects_oversize() -> None:
    s = _settings(design_image_max_bytes=10)
    with pytest.raises(InvalidImageError):
        validate_image(b"x" * 100, "image/png", s)


def test_make_image_key_isolates_by_user() -> None:
    key = make_image_key("user-a", "job-1", "image/png")
    assert key == "designs/user-a/job-1.png"
    key2 = make_image_key("user-b", "job-1", "image/png")
    assert key != key2


def test_upload_returns_key_and_presigned_url() -> None:
    fake = FakeMinioClient()
    store = ImageStore(_settings(), client=fake)
    stored = store.upload(user_id="u1", job_id="j1", data=b"\x89PNG", content_type="image/png")
    assert stored.key == "designs/u1/j1.png"
    assert "http://fake/" in stored.url
    assert stored.size == 4
    # 对象确实写入
    assert fake.objects[("ai-assets", "designs/u1/j1.png")] == b"\x89PNG"


def test_presigned_get_returns_url() -> None:
    fake = FakeMinioClient()
    store = ImageStore(_settings(), client=fake)
    url = store.presigned_get("designs/u1/j1.png")
    assert "http://fake/" in url


def test_get_object_returns_bytes() -> None:
    fake = FakeMinioClient()
    fake.objects[("ai-assets", "designs/u1/j1.png")] = b"img-bytes"
    store = ImageStore(_settings(), client=fake)
    assert store.get_object("designs/u1/j1.png") == b"img-bytes"


def test_ensure_bucket_idempotent() -> None:
    fake = FakeMinioClient()
    store = ImageStore(_settings(), client=fake)
    store._ensure_bucket()  # type: ignore[attr-defined]
    assert "ai-assets" in fake.created_buckets
    # 再调一次不报错
    store._ensure_bucket()  # type: ignore[attr-defined]
    assert "ai-assets" in fake.created_buckets
