"""BFF 服务间信任鉴权(M3 迁移后主鉴权)。

架构:前端 → BFF(校验用户 JWT)→ AI 服务(BFF 附加服务间 token)。
BFF 校验完前端 JWT 后,附加:
- X-Internal-Token: BFF 与 AI 服务共享的服务间密钥(证明请求来自 BFF)
- X-User-Id: 用户身份(BFF 透传,JWT payload.sub)
- X-User-Role: 用户角色(BFF 透传,JWT payload.role)

AI 服务不再持有用户 JWT secret,只验服务间 token + 读 BFF 透传的 header。
JWT 自验(get_current_user)降级为可选(调试/独立部署直连 AI 时用)。
"""

from __future__ import annotations

from typing import Any

from fastapi import Request

from app.api.errors import ForbiddenError, UnauthenticatedError
from app.auth.jwt import AuthUser
from app.core.config import Settings

__all__ = ["AuthDep", "AuthUser", "get_bff_user", "require_role"]


def _verify_internal_token(request: Request, settings: Settings) -> None:
    """校验 X-Internal-Token(服务间信任)。

    AI_SERVICE_TOKEN 由 BFF 与 AI 服务共享(环境变量,不入仓不入日志)。
    缺失/不匹配 → UnauthenticatedError(401)。
    """
    token = request.headers.get("X-Internal-Token") or request.headers.get("x-internal-token")
    expected = settings.ai_service_token.get_secret_value() if settings.ai_service_token else ""
    if not expected:
        # AI_SERVICE_TOKEN 未配置:开发环境放行(独立部署调试),生产应配
        # TODO(M5 联调后): 生产环境强制要求 token
        return
    if not token or token != expected:
        raise UnauthenticatedError(
            "缺少或无效的 X-Internal-Token", details={"reason": "invalid_internal_token"}
        )


def _user_from_headers(request: Request) -> AuthUser:
    """从 BFF 透传的 header 解析用户身份。

    X-User-Id 必填(无则 401);X-User-Role 可选。
    """
    user_id = request.headers.get("X-User-Id") or request.headers.get("x-user-id")
    if not user_id:
        raise UnauthenticatedError(
            "缺少 X-User-Id(BFF 未透传用户身份)", details={"reason": "missing_user_id"}
        )
    role = request.headers.get("X-User-Role") or request.headers.get("x-user-role")
    username = request.headers.get("X-User-Name") or request.headers.get("x-user-name")
    return AuthUser(user_id=user_id, username=username, role=role)


async def get_bff_user(request: Request) -> AuthUser:
    """FastAPI 依赖:BFF 服务间信任 → AuthUser。

    校验 X-Internal-Token(证明来自 BFF)+ 读 X-User-Id/X-User-Role(用户身份)。
    settings 从 app.state 取。
    """
    settings: Settings = request.app.state.settings
    _verify_internal_token(request, settings)
    return _user_from_headers(request)


def require_role(*allowed: str) -> Any:
    """FastAPI 依赖工厂:角色守卫(C 端访客禁工具调用用)。

    用法: Depends(require_role("admin"))
    visitor 尝试访问 → 403 ForbiddenError。
    """
    from fastapi import Depends

    async def _guard(user: AuthUser = Depends(get_bff_user)) -> AuthUser:
        if user.role and user.role not in allowed:
            raise ForbiddenError(
                f"角色 {user.role} 无权访问该操作",
                details={"required_roles": list(allowed), "actual_role": user.role},
            )
        return user

    return _guard


AuthDep = "get_bff_user"  # 路由 Depends 引用名(M3 后主鉴权)
