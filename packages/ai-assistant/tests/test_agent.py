"""P1-T5 agent 状态图单测（provider/retriever 全 mock，内存 checkpoint）。

覆盖：
- 各节点（understand/retrieve/generate/validate/hitl/feedback）行为
- 回环：validate 失败 → feedback → generate 重试 ≤ max_retries
- HITL 中断（awaiting_confirm）/ resume_after_confirm（applied/rejected）
- failed 态（校验超限）
- checkpoint 持久化 + 会话恢复
- 多租户隔离（A 用户不可见 B 会话）
"""

from __future__ import annotations

import pytest

from app.agent.checkpoint import InMemoryCheckpointStore, new_session_id
from app.agent.graph import AgentRunner
from app.agent.nodes import AgentDeps
from app.agent.state import AgentState, SessionStatus
from app.rag.retriever import RetrievedMaterial
from app.schemas.validators import MaterialRegistry

# ===== mock 依赖 =====


class MockProvider:
    """按预设序列返回结构化结果（控制 understand/generate 各轮输出）。"""

    def __init__(
        self,
        intent_kind: str = "generate_page",
        generated_root: dict | None = None,
        generate_error: str | None = None,
    ) -> None:
        self.intent_kind = intent_kind
        self.generated_root = generated_root or {
            "id": "root",
            "type": "LubanPage",
            "children": [{"id": "btn", "type": "LubanButton", "props": {"label": "提交"}}],
        }
        self.generate_error = generate_error
        self.generate_calls = 0

    def chat(self, messages, response_model):
        from app.agent.nodes import GeneratedSchema, GenerationIntent

        if response_model is GenerationIntent:
            return GenerationIntent(kind=self.intent_kind, summary="test")
        if response_model is GeneratedSchema:
            self.generate_calls += 1
            if self.generate_error and self.generate_calls == 1:
                raise RuntimeError(self.generate_error)
            return GeneratedSchema(root=self.generated_root)
        raise AssertionError(f"未预期的 response_model: {response_model}")

    def stream(self, messages):
        raise NotImplementedError

    @property
    def name(self) -> str:
        return "mock"

    @property
    def provider_key(self) -> str:
        return "mock"

    def raw_model(self):
        raise NotImplementedError


class MockRetriever:
    def search(self, query: str, *, top_k: int = 5):
        return [
            RetrievedMaterial(
                name="LubanButton",
                category="form",
                description="按钮",
                props_schema_json="{}",
                score=0.9,
            )
        ]


def _registry() -> MaterialRegistry:
    return MaterialRegistry(
        materials={
            "LubanPage": {"type": "object", "properties": {}},
            "LubanButton": {
                "type": "object",
                "properties": {"label": {"type": "string"}},
                "required": ["label"],
            },
        }
    )


def _deps(**kw) -> AgentDeps:
    return AgentDeps(
        provider=kw.get("provider", MockProvider()),
        retriever=kw.get("retriever", MockRetriever()),
        registry=kw.get("registry", _registry()),
    )


def _state(message: str = "做一个提交按钮页", user: str = "userA") -> AgentState:
    return AgentState(
        session_id=new_session_id(),
        user_id=user,
        user_message=message,
        max_retries=3,
    )


# ===== 状态图端到端 =====


@pytest.mark.asyncio
async def test_run_success_reaches_hitl() -> None:
    runner = AgentRunner(_deps())
    state = await runner.run(_state())
    # 生成成功 → awaiting_confirm（HITL）
    assert state.status == SessionStatus.AWAITING_CONFIRM
    assert state.interrupted is True
    assert state.generated_schema is not None
    assert state.generated_schema.root.type == "LubanPage"
    # progress 含 understand/retrieve/generate/validate/confirm
    types = [p["type"] for p in state.progress]
    assert "tool" in types
    assert "confirm" in types


@pytest.mark.asyncio
async def test_resume_confirm_applied() -> None:
    runner = AgentRunner(_deps())
    state = await runner.run(_state())
    assert state.status == SessionStatus.AWAITING_CONFIRM
    state = await runner.resume_after_confirm(state, confirmed=True)
    assert state.status == SessionStatus.APPLIED
    assert state.confirmed is True
    assert state.interrupted is False


@pytest.mark.asyncio
async def test_resume_reject_rejected() -> None:
    runner = AgentRunner(_deps())
    state = await runner.run(_state())
    state = await runner.resume_after_confirm(state, confirmed=False)
    assert state.status == SessionStatus.REJECTED
    assert state.confirmed is False


# ===== 回环重试 =====


@pytest.mark.asyncio
async def test_validate_failure_retries_within_limit() -> None:
    # generate 产非法 schema（props 缺必填 label）→ validate 失败 → 回环重试
    bad_root = {
        "id": "root",
        "type": "LubanPage",
        "children": [{"id": "btn", "type": "LubanButton", "props": {}}],
    }
    runner = AgentRunner(_deps(provider=MockProvider(generated_root=bad_root)))
    state = AgentState(
        session_id=new_session_id(),
        user_id="u",
        user_message="x",
        max_retries=3,
    )
    state = await runner.run(state)
    # 重试 3 次仍非法 → failed
    assert state.status == SessionStatus.FAILED
    assert state.retries == 3
    assert "校验" in (state.error or "")


@pytest.mark.asyncio
async def test_validate_retry_then_success() -> None:
    # 第一次产非法，第二次产合法（通过 generate_error 控制不了轮次，改用状态判断）
    # 用计数 provider：第1轮非法，第2轮合法
    class TwoPhaseProvider(MockProvider):
        def __init__(self) -> None:
            super().__init__()
            self._bad = {
                "id": "root",
                "type": "LubanPage",
                "children": [{"id": "b", "type": "LubanButton", "props": {}}],
            }
            self._good = {
                "id": "root",
                "type": "LubanPage",
                "children": [{"id": "b", "type": "LubanButton", "props": {"label": "ok"}}],
            }

        def chat(self, messages, response_model):
            from app.agent.nodes import GeneratedSchema, GenerationIntent

            if response_model is GenerationIntent:
                return GenerationIntent(kind="generate_page", summary="t")
            if response_model is GeneratedSchema:
                root = self._bad if self.generate_calls == 0 else self._good
                self.generate_calls += 1
                return GeneratedSchema(root=root)
            raise AssertionError

    runner = AgentRunner(_deps(provider=TwoPhaseProvider()))
    state = await runner.run(_state())
    # 第1轮失败回环，第2轮成功 → awaiting_confirm
    assert state.status == SessionStatus.AWAITING_CONFIRM
    assert state.retries == 1


# ===== generate 失败 → failed =====


@pytest.mark.asyncio
async def test_generate_error_propagates_failed() -> None:
    runner = AgentRunner(_deps(provider=MockProvider(generate_error="LLM down")))
    state = await runner.run(_state())
    assert state.status == SessionStatus.FAILED
    assert "生成失败" in (state.error or "")


# ===== checkpoint 持久化 + 恢复 =====


@pytest.mark.asyncio
async def test_checkpoint_persists_and_restores() -> None:
    store = InMemoryCheckpointStore()
    runner = AgentRunner(_deps(), store=store)
    state = await runner.run(_state(user="userA"))
    # 已持久化
    loaded = await store.load(state.session_id, "userA")
    assert loaded is not None
    assert loaded.status == SessionStatus.AWAITING_CONFIRM
    assert loaded.session_id == state.session_id


@pytest.mark.asyncio
async def test_checkpoint_list_sessions() -> None:
    store = InMemoryCheckpointStore()
    runner = AgentRunner(_deps(), store=store)
    await runner.run(_state(user="userA"))
    await runner.run(_state(user="userA"))
    await runner.run(_state(user="userB"))
    a = await store.list_sessions("userA")
    b = await store.list_sessions("userB")
    assert len(a) == 2
    assert len(b) == 1


@pytest.mark.asyncio
async def test_multitenant_isolation() -> None:
    """A 用户 JWT 调 AI，checkpoint 按 user 隔离，B 用户不可见 A 会话。"""
    store = InMemoryCheckpointStore()
    runner = AgentRunner(_deps(), store=store)
    state_a = await runner.run(_state(user="userA"))
    # B 用户尝试加载 A 的会话 → None
    assert await store.load(state_a.session_id, "userB") is None
    # B 删 A 的会话 → 无效（不影响 A）
    await store.delete(state_a.session_id, "userB")
    assert await store.load(state_a.session_id, "userA") is not None  # A 仍可见


@pytest.mark.asyncio
async def test_checkpoint_update_status() -> None:
    store = InMemoryCheckpointStore()
    runner = AgentRunner(_deps(), store=store)
    state = await runner.run(_state())
    await store.update_status(state.session_id, state.user_id, SessionStatus.APPLIED)
    loaded = await store.load(state.session_id, state.user_id)
    assert loaded is not None and loaded.status == SessionStatus.APPLIED


@pytest.mark.asyncio
async def test_resume_persists_after_confirm() -> None:
    store = InMemoryCheckpointStore()
    runner = AgentRunner(_deps(), store=store)
    state = await runner.run(_state())
    await runner.resume_after_confirm(state, confirmed=True)
    loaded = await store.load(state.session_id, state.user_id)
    assert loaded is not None
    assert loaded.status == SessionStatus.APPLIED


# ===== 节点单元（细粒度）=====


@pytest.mark.asyncio
async def test_retrieve_fallback_on_error() -> None:
    class BrokenRetriever:
        def search(self, query, *, top_k=5):
            raise RuntimeError("milvus down")

    state = _state()
    from app.agent.nodes import retrieve

    state = await retrieve(state, _deps(retriever=BrokenRetriever()))
    # 降级为全量物料
    assert set(state.retrieved_materials) == {"LubanPage", "LubanButton"}
