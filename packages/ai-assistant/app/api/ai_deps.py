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
    """物料注册表:P0-5 修复,用内置物料清单填充(61 个,从 luban-low-code 抽取)。

    generate 节点据此拿到真实物料名,不再瞎编。
    校验闸对未注册物料占位不崩(validate_page_schema 缺物料不阻断),
    但有清单后 LLM 生成命中率大幅提升。
    """
    from app.rag.builtin_materials import BUILTIN_MATERIALS

    registry = MaterialRegistry()
    for m in BUILTIN_MATERIALS:
        # name → 空 propsSchema(校验闸对未知 props 占位放行;真实 propsSchema 后续从物料定义补)
        registry.materials[m.name] = {}
    return registry


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
    """构造 agent 依赖(provider/retriever/registry,tool_client 由端点按用户身份注入)。

    registry 由内置物料清单填充(P0-5);RAG retriever 从 Qdrant 检索(M2)。
    """
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
