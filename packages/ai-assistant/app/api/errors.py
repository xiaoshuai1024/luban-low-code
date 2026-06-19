"""统一错误模型（对齐 luban 风格 {code, message, details?}）。

各端点抛 ApiError 子类 → FastAPI exception_handler 转 HTTP 响应。
错误码（与 §9.2 契约对齐）：
  UNAUTHENTICATED       401
  AI_FEATURE_DISABLED   503
  AI_GENERATION_FAILED  500
  AI_VALIDATION_FAILED  422
"""

from __future__ import annotations

from typing import Any


class ApiError(Exception):
    code: str = "INTERNAL"
    status_code: int = 500

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_body(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "details": self.details}


class UnauthenticatedError(ApiError):
    code = "UNAUTHENTICATED"
    status_code = 401


class FeatureDisabledError(ApiError):
    code = "AI_FEATURE_DISABLED"
    status_code = 503


class GenerationFailedError(ApiError):
    code = "AI_GENERATION_FAILED"
    status_code = 500


class ValidationFailedError(ApiError):
    code = "AI_VALIDATION_FAILED"
    status_code = 422
