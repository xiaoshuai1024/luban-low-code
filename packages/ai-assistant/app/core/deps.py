"""依赖注入容器（FastAPI Depends）。

主旨：为测试可替换——所有外部依赖（provider/checkpoint/retriever）经此取单例，
测试用 dependency_overrides 替换为 mock，不依赖真实容器。
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings

# 便捷别名：路由签名写 `s: SettingsDep` 即注入单例 settings
SettingsDep = Annotated[Settings, Depends(get_settings)]

__all__ = ["Settings", "SettingsDep", "get_settings"]
