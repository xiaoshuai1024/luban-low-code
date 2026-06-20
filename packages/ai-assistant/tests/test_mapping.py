"""P2-T2 设计稿组件→物料映射规则单测（plan P2）。

覆盖：
  - map_component_type：已知组件→物料；未知→LubanContainer 占位
  - component_to_node：不确定组件→占位+标注；数据展示→需配置数据源
  - understanding_to_schema：整体理解→root + children 顺序
  - map_layout_hint：布局描述→容器类型暗示
"""

from __future__ import annotations

from app.agent.mapping_rules import (
    component_to_node,
    map_component_type,
    map_layout_hint,
    understanding_to_schema,
)
from app.llm.multimodal import DesignComponent, DesignUnderstanding


def test_map_component_type_known() -> None:
    assert map_component_type("table") == "LubanTable"
    assert map_component_type("FORM") == "LubanForm"
    assert map_component_type("nav") == "LubanMenu"


def test_map_component_type_unknown_falls_back_to_container() -> None:
    assert map_component_type("weird-thing") == "LubanContainer"


def test_component_to_node_uncertain_makes_placeholder() -> None:
    comp = DesignComponent(type="unknown", description="看不清", uncertain=True)
    node = component_to_node(comp)
    assert node.type == "LubanContainer"
    assert node.props is not None
    assert "待人工确认" in node.props.get("_note", "")


def test_component_to_node_text_component_fills_text() -> None:
    comp = DesignComponent(type="button", description="提交按钮", text="提交")
    node = component_to_node(comp)
    assert node.type == "LubanButton"
    assert node.props == {"text": "提交"}


def test_component_to_node_data_display_notes_datasource() -> None:
    comp = DesignComponent(type="table", description="用户列表")
    node = component_to_node(comp)
    assert node.type == "LubanTable"
    assert "需配置数据源" in (node.props or {}).get("_note", "")


def test_understanding_to_schema_builds_root_with_children() -> None:
    u = DesignUnderstanding(
        layout="顶部导航+主体表格",
        title="用户管理",
        components=[
            DesignComponent(type="nav", description="主导航"),
            DesignComponent(type="table", description="用户列表"),
        ],
        summary="用户列表页",
    )
    root = understanding_to_schema(u, known_materials={"LubanMenu", "LubanTable"})
    assert root.type == "LubanPage"
    assert root.props == {"title": "用户管理"}
    assert len(root.children or []) == 2
    assert root.children[0].type == "LubanMenu"
    assert root.children[1].type == "LubanTable"


def test_understanding_to_schema_marks_unregistered_material() -> None:
    u = DesignUnderstanding(
        layout="简单",
        title="t",
        components=[DesignComponent(type="table", description="x")],
        summary="s",
    )
    root = understanding_to_schema(u, known_materials=set())  # 无已知物料
    table_node = root.children[0]
    assert "未注册" in (table_node.props or {}).get("_note", "")


def test_map_layout_hint_detects_split() -> None:
    assert map_layout_hint("左右分栏布局") == "LubanRow"
    assert map_layout_hint("卡片网格") == "LubanCard"
    assert map_layout_hint("普通页面") is None
