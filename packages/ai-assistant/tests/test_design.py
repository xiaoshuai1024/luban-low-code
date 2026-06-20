"""P2-T2 design workflow 节点 + 运行器单测（plan P2）。

mock provider（chat_with_image 返回固定 DesignUnderstanding）+ fake ImageStore。
覆盖：understand_image / map_to_materials / validate / hitl / 回环 / DesignRunner.run。
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import SecretStr

from app.agent.design_graph import DesignRunner
from app.agent.design_nodes import DesignDeps, DesignState, route_after_validate
from app.agent.state import SessionStatus
from app.core.config import Settings
from app.llm.multimodal import DesignComponent, DesignUnderstanding
from app.llm.provider import Provider
from app.schemas.page_schema import NodeSchema, PageSchema
from app.schemas.validators import MaterialRegistry


def _settings() -> Settings:
    return Settings(
        environment="test",
        auth_jwt_secret=SecretStr("k"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
    )


class _MockVLMProvider(Provider):
    """mock VLM：chat_with_image 返回固定理解结果。"""

    def __init__(self, understanding: DesignUnderstanding) -> None:
        self._u = understanding

    @property
    def name(self) -> str:
        return "mock-vlm"

    @property
    def provider_key(self) -> str:
        return "mock"

    def chat(self, messages: list[Any], response_model: type[Any]) -> Any:  # pragma: no cover
        raise NotImplementedError

    def stream(self, messages: list[Any]) -> Any:  # pragma: no cover
        raise NotImplementedError

    def raw_model(self) -> Any:  # pragma: no cover
        raise NotImplementedError

    def chat_with_image(
        self, messages: list[Any], image_bytes: bytes, image_mime: str, response_model: type[Any]
    ) -> Any:
        return self._u


class _FakeImageStore:
    """fake ImageStore：get_object 返回固定字节。"""

    def __init__(self) -> None:
        self.fetched_keys: list[str] = []

    def get_object(self, key: str) -> bytes:
        self.fetched_keys.append(key)
        return b"fake-image-bytes"


def _understanding() -> DesignUnderstanding:
    return DesignUnderstanding(
        layout="顶部导航+主体表格",
        title="用户管理",
        components=[
            DesignComponent(type="nav", description="主导航"),
            DesignComponent(type="table", description="用户列表"),
        ],
        summary="用户列表页",
    )


def _registry() -> MaterialRegistry:
    # 注册用到的物料，使校验闸通过
    return MaterialRegistry(materials={"LubanPage": {}, "LubanMenu": {}, "LubanTable": {}})


def _deps(understanding: DesignUnderstanding | None = None) -> DesignDeps:
    return DesignDeps(
        provider=_MockVLMProvider(understanding or _understanding()),
        image_store=_FakeImageStore(),  # type: ignore[arg-type]
        registry=_registry(),
    )


def _state() -> DesignState:
    return DesignState(
        job_id="job-1",
        user_id="u1",
        image_key="designs/u1/job-1.png",
        image_bytes=b"img",  # 已注入，免拉取
        image_mime="image/png",
    )


@pytest.mark.asyncio
async def test_understand_image_success() -> None:
    deps = _deps()
    state = await _deps_provider_understand(deps)
    assert state.understanding is not None
    assert len(state.understanding.components) == 2
    assert any(e["type"] == "tool" and e.get("tool") == "understand_image" for e in state.progress)


async def _deps_provider_understand(deps: DesignDeps) -> DesignState:
    from app.agent.design_nodes import understand_image

    state = _state()
    return await understand_image(state, deps)


@pytest.mark.asyncio
async def test_understand_image_fetches_image_when_bytes_none() -> None:
    from app.agent.design_nodes import understand_image

    deps = _deps()
    state = _state()
    state.image_bytes = None
    await understand_image(state, deps)
    fake_store = deps.image_store
    assert fake_store.fetched_keys == ["designs/u1/job-1.png"]  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_map_to_materials_builds_schema() -> None:
    from app.agent.design_nodes import map_to_materials, understand_image

    deps = _deps()
    state = _state()
    state = await understand_image(state, deps)
    state = await map_to_materials(state, deps)
    assert state.generated_schema is not None
    assert state.generated_schema.root.type == "LubanPage"
    types = [c.type for c in state.generated_schema.root.children or []]
    assert "LubanMenu" in types and "LubanTable" in types


@pytest.mark.asyncio
async def test_runner_full_flow_reaches_awaiting_confirm() -> None:
    deps = _deps()
    runner = DesignRunner(deps)
    state = _state()
    final = await runner.run(state)
    assert final.status == SessionStatus.AWAITING_CONFIRM
    assert final.generated_schema is not None
    assert final.generated_schema.root.type == "LubanPage"


@pytest.mark.asyncio
async def test_runner_failed_when_no_understanding() -> None:
    # provider 抛异常 → understand_image 失败 → failed
    class _FailProvider(_MockVLMProvider):
        def chat_with_image(self, *a: Any, **k: Any) -> Any:  # type: ignore[override]
            raise RuntimeError("VLM down")

    deps = DesignDeps(
        provider=_FailProvider(_understanding()),
        image_store=_FakeImageStore(),
        registry=_registry(),
    )  # type: ignore[arg-type]
    runner = DesignRunner(deps)
    state = _state()
    final = await runner.run(state)
    assert final.status == SessionStatus.FAILED
    assert final.error is not None


def test_route_after_validate_hitl_on_clean() -> None:
    state = DesignState(job_id="j", user_id="u", image_key="k")
    state.generated_schema = PageSchema(root=NodeSchema(id="r", type="LubanPage"))
    state.error = None
    assert route_after_validate(state) == "hitl"


def test_route_after_validate_feedback_on_error() -> None:
    state = DesignState(job_id="j", user_id="u", image_key="k")
    state.generated_schema = PageSchema(root=NodeSchema(id="r", type="LubanPage"))
    state.error = "校验失败"
    assert route_after_validate(state) == "feedback"


def test_route_after_validate_failed_on_terminal() -> None:
    state = DesignState(job_id="j", user_id="u", image_key="k")
    state.status = SessionStatus.FAILED
    assert route_after_validate(state) == "failed"


@pytest.mark.asyncio
async def test_resume_after_confirm_applied_and_rejected() -> None:
    deps = _deps()
    runner = DesignRunner(deps)
    state = _state()
    state = await runner.run(state)
    applied = await runner.resume_after_confirm(state, True)
    assert applied.status == SessionStatus.APPLIED
    state2 = _state()
    state2 = await runner.run(state2)
    rejected = await runner.resume_after_confirm(state2, False)
    assert rejected.status == SessionStatus.REJECTED
