"""应用配置（pydantic-settings，从环境变量/.env 读取）。

所有敏感字段（LLM key / JWT secret / SSH 凭证）仅经环境变量注入，
禁硬编码、禁入仓、禁入日志。`.env.example` 只放占位键名。
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class ModelProvider(StrEnum):
    """运行期单一 provider，仅改 MODEL_PROVIDER 配置切换，不协同。"""

    GLM = "glm"  # 智谱 GLM-4
    DEEPSEEK = "deepseek"
    QWEN = "tongyi"  # 通义千问


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ===== 应用 =====
    app_name: str = "luban-ai-assistant"
    environment: Literal["dev", "test", "prod"] = "dev"
    log_level: str = "INFO"

    # ===== FeatureGate（与 engine FeatureGate 对齐语义）=====
    ai_generate_enabled: bool = True  # key: ai.generate — 关闭则 /ai/generate 返回 503
    ai_guidance_enabled: bool = True  # key: ai.guidance — 关闭则隐藏引导


    # ===== CORS / 前端 =====
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # ===== BFF 服务间信任(M3)=====
    ai_service_token: SecretStr = SecretStr("")  # BFF 与 AI 服务共享密钥,环境变量注入

    # ===== JWT（M3 后 BFF 服务间信任为主，JWT 自验降级可选）=====
    auth_jwt_secret: SecretStr = SecretStr("change-me")
    auth_jwt_algorithm: str = "HS256"

    # ===== 模型 provider =====
    # 运行期单一，仅改 MODEL_PROVIDER 切换三家
    model_provider: ModelProvider = ModelProvider.GLM
    # 各家 key + base_url（OpenAI 兼容协议走 langchain_openai；智谱/通义亦可兼容协议）
    glm_api_key: SecretStr = SecretStr("")
    glm_base_url: str = "https://open.bigmodel.cn/api/paas/v4/"
    glm_model: str = "glm-4"

    deepseek_api_key: SecretStr = SecretStr("")
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"

    qwen_api_key: SecretStr = SecretStr("")
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen-plus"

    # 校验闸回环重试上限（LLM 产非法 schema 时）
    validation_max_retries: int = 3

    # ===== PostgreSQL（checkpoint + 会话 + 元数据）=====
    postgres_dsn: str = "postgresql://luban:luban@postgres:5432/luban_ai"

    # ===== Qdrant（物料知识 hybrid 检索，M2 替换 Milvus）=====
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "luban_materials"
    qdrant_docs_collection: str = "luban_docs"
    qdrant_api_key: SecretStr = SecretStr("")  # 生产可能启用;本地无 key

    # ===== 云端 embedding（与 LLM 解耦，可独立配置）=====
    embedding_provider: Literal["glm", "openai"] = "glm"
    embedding_api_key: SecretStr = SecretStr("")
    embedding_base_url: str = "https://open.bigmodel.cn/api/paas/v4/"
    embedding_model: str = "embedding-3"

    @property
    def is_prod(self) -> bool:
        return self.environment == "prod"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """单例配置（FastAPI Depends 用）。"""
    return Settings()
