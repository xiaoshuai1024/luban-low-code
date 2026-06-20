"""P1-T9 引导能力单测：读 schema 给建议，不编造物料。"""

from __future__ import annotations

from pydantic import SecretStr

from app.agent.guidance import GUIDANCE_SYSTEM_PROMPT, generate_guidance
from app.core.config import Settings
from app.schemas.page_schema import NodeDatasource, NodeSchema, PageSchema

KNOWN = {"LubanPage", "LubanButton", "LubanForm", "LubanTable", "LubanPagination", "LubanInput"}


def _page(children: list[NodeSchema]) -> PageSchema:
    return PageSchema(root=NodeSchema(id="root", type="LubanPage", children=children))


# ===== 空画布引导 =====


def test_empty_canvas_gives_onboarding_tips() -> None:
    tips = generate_guidance(None, KNOWN)
    titles = [t.title for t in tips]
    assert any("开始构建" in t for t in titles)
    # 建议引用的物料须在已知集合内
    for t in tips:
        if t.action and t.action.startswith("add:"):
            assert t.action.split(":", 1)[1] in KNOWN


def test_empty_canvas_does_not_invent_materials() -> None:
    """空画布建议里不出现已知集合外的物料。"""
    limited = {"LubanPage", "LubanButton"}  # 无 LubanTable
    tips = generate_guidance(None, limited)
    for t in tips:
        if t.action and t.action.startswith("add:"):
            assert t.action.split(":", 1)[1] in limited


def test_schema_with_no_real_content_treated_as_empty() -> None:
    """root 但 children 空 → 视为空画布。"""
    page = _page([])
    tips = generate_guidance(page, KNOWN)
    assert any("开始构建" in t.title for t in tips)


# ===== 结构化建议：表单无按钮 =====


def test_form_without_button_suggests_button() -> None:
    page = _page([NodeSchema(id="f", type="LubanForm")])
    tips = generate_guidance(page, KNOWN)
    assert any("提交按钮" in t.title for t in tips)
    # action 指向已知物料
    btn_tip = next(t for t in tips if "提交按钮" in t.title)
    assert btn_tip.action == "add:LubanButton"


def test_form_with_button_does_not_repeat_suggestion() -> None:
    page = _page(
        [
            NodeSchema(id="f", type="LubanForm"),
            NodeSchema(id="b", type="LubanButton"),
        ]
    )
    tips = generate_guidance(page, KNOWN)
    assert not any("提交按钮" in t.title for t in tips)


# ===== 表格无分页 =====


def test_table_without_pagination_suggests_pagination() -> None:
    page = _page([NodeSchema(id="t", type="LubanTable")])
    tips = generate_guidance(page, KNOWN)
    assert any("分页" in t.title for t in tips)


def test_table_suggestion_only_if_pagination_known() -> None:
    """若 LubanPagination 不在已知物料集，不编造建议。"""
    page = _page([NodeSchema(id="t", type="LubanTable")])
    no_pg = {"LubanPage", "LubanTable"}  # 无 LubanPagination
    tips = generate_guidance(page, no_pg)
    assert not any("分页" in t.title for t in tips)


# ===== 数据源提示 =====


def test_data_component_without_datasource_warns() -> None:
    page = _page([NodeSchema(id="t", type="LubanTable")])
    tips = generate_guidance(page, KNOWN)
    assert any("数据源" in t.title and t.level == "warning" for t in tips)


def test_data_component_with_datasource_no_warn() -> None:
    table = NodeSchema(
        id="t", type="LubanTable", datasource=NodeDatasource(id="ds1", varName="rows")
    )
    page = _page([table])
    tips = generate_guidance(page, KNOWN)
    assert not any("数据源" in t.title for t in tips)


# ===== 保存提示 + 兜底 =====


def test_always_suggests_saving() -> None:
    page = _page([NodeSchema(id="b", type="LubanButton")])
    tips = generate_guidance(page, KNOWN)
    assert any("保存" in t.title for t in tips)


def test_generic_suggestion_when_no_specific_tip() -> None:
    """纯按钮页（无表单/表格/数据源缺失）→ 给通用下一步建议。"""
    page = _page([NodeSchema(id="b", type="LubanButton")])
    tips = generate_guidance(page, KNOWN)
    assert any("继续完善" in t.title for t in tips)


# ===== system prompt 约束 =====


def test_guidance_system_prompt_forbids_invention() -> None:
    assert "绝不编造" in GUIDANCE_SYSTEM_PROMPT or "不编造" in GUIDANCE_SYSTEM_PROMPT
    assert "物料" in GUIDANCE_SYSTEM_PROMPT


# ===== 端点 + FeatureGate =====


def _settings(**over) -> Settings:
    base = dict(
        environment="test",
        auth_jwt_secret=SecretStr("test-jwt-secret-min-32-bytes-long!!"),
        glm_api_key=SecretStr("k"),
        deepseek_api_key=SecretStr("k"),
        qwen_api_key=SecretStr("k"),
        embedding_api_key=SecretStr("k"),
        langfuse_public_key=SecretStr("k"),
        langfuse_secret_key=SecretStr("k"),
    )
    base.update(over)
    return Settings(**base)


def _token(settings: Settings) -> str:
    import jwt

    return jwt.encode(
        {"sub": "u1", "username": "t", "role": "admin"},
        settings.auth_jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


def test_guidance_endpoint_returns_tips() -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = _settings()
    app = create_app(settings=settings)
    with TestClient(app) as c:
        resp = c.get(
            "/ai/guidance?empty=true", headers={"Authorization": f"Bearer {_token(settings)}"}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["schema_empty"] is True
    assert len(body["tips"]) >= 1


def test_guidance_endpoint_503_when_disabled() -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = _settings(ai_guidance_enabled=False)
    app = create_app(settings=settings)
    with TestClient(app) as c:
        resp = c.get("/ai/guidance", headers={"Authorization": f"Bearer {_token(settings)}"})
    assert resp.status_code == 503
    assert resp.json()["code"] == "AI_FEATURE_DISABLED"


def test_guidance_endpoint_requires_auth() -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings=_settings())
    with TestClient(app) as c:
        resp = c.get("/ai/guidance")
    assert resp.status_code == 401
