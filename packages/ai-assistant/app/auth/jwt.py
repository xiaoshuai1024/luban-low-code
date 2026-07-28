"""JWT 鉴权（复用 luban AUTH_JWT_SECRET 自验）。

payload {sub, username, role}。AI 服务读同密钥验签，不依赖 BFF。
缺失/无效/过期 → 抛 UnauthenticatedError（端点转 401）。
"""

from __future__ import annotations

import jwt
from fastapi import Request
from pydantic import BaseModel

from app.api.errors import UnauthenticatedError
from app.core.config import Settings


class AuthUser(BaseModel):
    """从 JWT 解析出的用户（多租户隔离用 sub）。"""

    user_id: str
    username: str | None = None
    role: str | None = None


def decode_token(token: str, settings: Settings) -> AuthUser:
    """验签并解析 payload。失败抛 UnauthenticatedError。"""
    try:
        payload = jwt.decode(
            token,
            settings.auth_jwt_secret.get_secret_value(),
            algorithms=[settings.auth_jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as e:
        raise UnauthenticatedError("token 已过期", details={"reason": "expired"}) from e
    except jwt.InvalidTokenError as e:
        raise UnauthenticatedError("无效 token", details={"reason": "invalid"}) from e

    # luban payload：sub(=userId) / username / role
    sub = payload.get("sub") or payload.get("userId") or payload.get("uid")
    if not sub:
        raise UnauthenticatedError("payload 缺 sub", details={"reason": "missing_sub"})
    return AuthUser(
        user_id=str(sub),
        username=payload.get("username"),
        role=payload.get("role"),
    )


def _extract_bearer(request: Request) -> str:
    """从 Authorization: Bearer <token> 取 token。"""
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise UnauthenticatedError("缺少 Authorization Bearer 头")
    return auth.split(" ", 1)[1].strip()


async def get_current_user(request: Request) -> AuthUser:
    """FastAPI 依赖：验 JWT → AuthUser。无/无效 token → 401。

    settings 从 app.state 取（测试注入的 settings 生效），不走 get_settings 单例。
    """
    token = _extract_bearer(request)
    settings: Settings = request.app.state.settings
    return decode_token(token, settings)


AuthDep = "get_current_user"  # 路由 Depends 引用名
