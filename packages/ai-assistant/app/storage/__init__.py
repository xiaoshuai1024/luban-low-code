"""storage 包 — 对象存储（MinIO 图片，plan P2）。"""

from app.storage.minio import ImageStore, StoredImage, make_image_key, validate_image

__all__ = ["ImageStore", "StoredImage", "make_image_key", "validate_image"]
