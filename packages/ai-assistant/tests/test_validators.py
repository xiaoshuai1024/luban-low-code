"""P1-T3 校验闸单测：结构/物料/propsSchema/表达式/循环/ID。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.errors import ValidationFailedError
from app.schemas.page_schema import NodeSchema, PageSchema
from app.schemas.validators import (
    MaterialRegistry,
    collect_missing_materials,
    validate_page_schema,
)


def _registry_with_button() -> MaterialRegistry:
    """含 LubanButton 物料的注册表（props: label 必填）。"""
    return MaterialRegistry(
        materials={
            "LubanButton": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "disabled": {"type": "boolean"},
                },
                "required": ["label"],
            },
            "LubanPage": {"type": "object", "properties": {}},
        }
    )


# ===== 合法 schema 通过 =====


def test_valid_page_passes() -> None:
    page = PageSchema(
        root=NodeSchema(
            id="r",
            type="LubanPage",
            children=[
                NodeSchema(id="b1", type="LubanButton", props={"label": "提交"}),
            ],
        )
    )
    result = validate_page_schema(page, _registry_with_button())
    assert result.root.id == "r"


def test_missing_id_is_filled_with_uuid() -> None:
    page = PageSchema(
        root=NodeSchema(type="LubanPage")  # 无 id
    )
    result = validate_page_schema(page, _registry_with_button())
    assert result.root.id  # 已补 uuid
    assert len(result.root.id) >= 32


# ===== 结构非法（Pydantic）=====


def test_extra_field_rejected() -> None:
    # Pydantic extra=forbid 应拒绝未知字段（模拟 AI 产了不存在字段）
    with pytest.raises(ValidationError):
        NodeSchema(id="x", type="LubanButton", unknownField="oops")  # type: ignore[call-arg]


# ===== 物料缺失：占位不崩 =====


def test_missing_material_does_not_crash() -> None:
    page = PageSchema(
        root=NodeSchema(
            id="r",
            type="LubanPage",
            children=[NodeSchema(id="g", type="GhostMaterial")],
        )
    )
    registry = _registry_with_button()  # 无 GhostMaterial
    # 不抛（占位策略）
    result = validate_page_schema(page, registry)
    assert result.root.id == "r"


def test_collect_missing_materials() -> None:
    page = PageSchema(
        root=NodeSchema(
            id="r",
            type="LubanPage",
            children=[
                NodeSchema(id="g1", type="GhostA"),
                NodeSchema(id="g2", type="GhostB"),
            ],
        )
    )
    missing = collect_missing_materials(page, _registry_with_button())
    assert missing == ["GhostA", "GhostB"]


# ===== propsSchema 违规 =====


def test_props_schema_violation_rejected() -> None:
    # LubanButton 要求 label 为 string，给数字应失败
    page = PageSchema(
        root=NodeSchema(id="b", type="LubanButton", props={"label": 123})  # type: ignore[dict-item]
    )
    with pytest.raises(ValidationFailedError, match="propsSchema"):
        validate_page_schema(page, _registry_with_button())


def test_props_required_missing_rejected() -> None:
    page = PageSchema(
        root=NodeSchema(id="b", type="LubanButton", props={})  # 缺必填 label
    )
    with pytest.raises(ValidationFailedError):
        validate_page_schema(page, _registry_with_button())


# ===== 表达式沙箱 =====


def test_visible_with_eval_rejected() -> None:
    page = PageSchema(
        root=NodeSchema(id="b", type="LubanButton", visible="eval('x')", props={"label": "ok"})
    )
    with pytest.raises(ValidationFailedError, match="visible 表达式非法"):
        validate_page_schema(page, _registry_with_button())


def test_events_with_window_rejected() -> None:
    page = PageSchema(
        root=NodeSchema(
            id="b",
            type="LubanButton",
            events={"click": "window.location='/x'"},
            props={"label": "ok"},
        )
    )
    with pytest.raises(ValidationFailedError, match="事件"):
        validate_page_schema(page, _registry_with_button())


def test_valid_visible_expression_passes() -> None:
    page = PageSchema(
        root=NodeSchema(
            id="b", type="LubanButton", visible="count > 0", props={"label": "ok"}
        )
    )
    validate_page_schema(page, _registry_with_button())


# ===== 重复 ID =====


def test_duplicate_id_rejected() -> None:
    page = PageSchema(
        root=NodeSchema(
            id="dup",
            type="LubanPage",
            children=[NodeSchema(id="dup", type="LubanButton", props={"label": "ok"})],
        )
    )
    with pytest.raises(ValidationFailedError, match="重复"):
        validate_page_schema(page, _registry_with_button())


# ===== 循环引用 =====


def test_cycle_rejected() -> None:
    # 手工构造环：a 的 children 含 a 自身
    # 注：自引用环同时触发"重复 id"（同一节点 id=a 出现两次）或"循环引用"，
    # 取决于 ID/环检查先后；此处只断言被校验闸拒绝。
    a = NodeSchema(id="a", type="LubanPage")
    a.children = [a]  # 自引用环
    page = PageSchema(root=a)
    with pytest.raises(ValidationFailedError):
        validate_page_schema(page, _registry_with_button())
