"""agent 运行依赖工厂（供 API 端点用，可经 dependency_overrides 替换为 mock）。

聚合 provider/retriever/registry/checkpoint → AgentDeps + AgentRunner。
测试用 app.dependency_overrides[get_agent_runner] 注入 mock 实现。
"""

from __future__ import annotations

from functools import lru_cache

from app.agent.checkpoint import CheckpointStore, InMemoryCheckpointStore, PostgresCheckpointStore
from app.agent.graph import AgentRunner
from app.agent.nodes import AgentDeps
from app.agent.tools import ToolClient
from app.core.config import Settings, get_settings
from app.llm.adapters import get_provider
from app.rag.embedding import get_embedder
from app.rag.retriever import Retriever
from app.schemas.validators import MaterialRegistry


def _build_registry(settings: Settings) -> MaterialRegistry:
    """物料注册表：生产从 Milvus 读，测试注入 mock。P1 用空注册表 + RAG 兜底。"""
    # P1-T6：暂用空注册表（物料由 RAG 检索提供上下文，校验闸对未知物料占位不崩）
    return MaterialRegistry()


@lru_cache(maxsize=1)
def _memory_store() -> InMemoryCheckpointStore:
    return InMemoryCheckpointStore()


def get_checkpoint_store(settings: Settings | None = None) -> CheckpointStore:
    """checkpoint store：dev/test 内存，prod Postgres。"""
    s = settings or get_settings()
    if s.environment in ("test", "dev"):
        return _memory_store()
    return PostgresCheckpointStore(s)


def get_agent_deps(settings: Settings | None = None) -> AgentDeps:
    """构造 agent 依赖(provider/retriever/registry,tool_client 由端点按用户身份注入)。"""
    s = settings or get_settings()
    embedder = get_embedder(s)
    return AgentDeps(
        provider=get_provider(s),
        retriever=Retriever(s, embedder),
        registry=_build_registry(s),
        tool_client=None,  # 端点用 with_tool_client() 按用户身份注入
    )


def build_tool_client(settings: Settings, user_id: str, user_role: str) -> ToolClient | None:
    """按用户身份构造工具回环 client。

    visitor 角色禁工具调用(返回 None);admin/其他角色返回带身份的 ToolClient。
    """
    if user_role == "visitor":
        return None
    return ToolClient(
        base_url=settings.bff_base_url,
        ai_service_token=settings.ai_service_token.get_secret_value() if settings.ai_service_token else "",
        user_id=user_id,
        user_role=user_role or "admin",
    )


def with_tool_client(deps: AgentDeps, tool_client: ToolClient | None) -> AgentDeps:
    """返回带 tool_client 的 deps 副本(不修改全局 deps,请求级隔离)。"""
    from dataclasses import replace

    return replace(deps, tool_client=tool_client)


def get_agent_runner() -> AgentRunner:
    """FastAPI 依赖：返回 AgentRunner（测试可 override）。"""
    deps = get_agent_deps()
    store = get_checkpoint_store()
    return AgentRunner(deps, store)


__all__ = [
    "get_agent_deps",
    "get_agent_runner",
    "get_checkpoint_store",
]
