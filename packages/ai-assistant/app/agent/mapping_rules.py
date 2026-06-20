"""agent/mapping_rules.py — 设计稿组件→luban 物料映射规则（plan P2-T2）。

把多模态识别到的 DesignComponent（table/form/list/nav/...）映射到 luban 物料类型
（LubanTable/LubanForm/LubanList/LubanMenu/LubanTabs/...），并生成对应 NodeSchema。

精度边界（plan §3 诚实声明）：
- 常规设计稿精度足够；识别不确定的组件 → 占位 LubanContainer + 标注「待确认」，
  不静默产出错误 schema。
- 数据展示类绑定空 datasource 占位 + 标注「需配置数据源」。
"""

from __future__ import annotations

import uuid
from typing import Any

from app.llm.multimodal import DesignComponent, DesignUnderstanding
from app.schemas.page_schema import NodeSchema

# 组件类型 → luban 物料类型映射
_COMPONENT_TO_MATERIAL: dict[str, str] = {
    "table": "LubanTable",
    "form": "LubanForm",
    "list": "LubanList",
    "nav": "LubanMenu",
    "menu": "LubanMenu",
    "tabs": "LubanTabs",
    "button": "LubanButton",
    "text": "LubanText",
    "image": "LubanImage",
    "container": "LubanContainer",
}


def map_component_type(comp_type: str) -> str:
    """组件类型 → luban 物料类型（未知 → LubanContainer 占位）。"""
    return _COMPONENT_TO_MATERIAL.get(comp_type.lower(), "LubanContainer")


def _node_id(material: str) -> str:
    return f"{material.lower()}-{uuid.uuid4().hex[:8]}"


def component_to_node(comp: DesignComponent) -> NodeSchema:
    """单个组件 → NodeSchema。不确定 → 占位 LubanContainer + 标注。"""
    if comp.uncertain:
        # 占位：不强行猜测，标「待确认」
        return NodeSchema(
            id=_node_id("uncertain"),
            type="LubanContainer",
            props={"_note": "待人工确认：识别不确定", "_original": comp.description},
            children=[],
        )
    material = map_component_type(comp.type)
    props: dict[str, Any] = {}
    # 文字类组件：填 text
    if comp.text and material in ("LubanText", "LubanButton"):
        props["text"] = comp.text
    # 数据展示类：标注需配置数据源
    if material in ("LubanTable", "LubanList"):
        props["_note"] = "需配置数据源"
    return NodeSchema(id=_node_id(material), type=material, props=props)


def understanding_to_schema(
    understanding: DesignUnderstanding,
    known_materials: set[str] | None = None,
) -> NodeSchema:
    """整体理解结果 → PageSchema.root（LubanPage 根 + 子节点）。

    映射规则：
      - root = LubanPage（含 title prop）
      - 各 component 顺序映射为 root.children
      - 容器类组件（nav/layout）递归含其子组件
    """
    known = known_materials or set()
    title = understanding.title or "设计稿页面"
    children: list[NodeSchema] = []
    for comp in understanding.components:
        node = component_to_node(comp)
        # 若物料未注册（unknown），仍保留节点但标注（校验闸会 collect_missing_materials）。
        # 未注册标注优先于数据源标注（更重要的待处理项）。
        if node.type not in known and node.type != "LubanContainer":
            props = node.props or {}
            props["_note"] = f"物料 {node.type} 未注册，待确认"
            node.props = props
        children.append(node)

    return NodeSchema(
        id="root",
        type="LubanPage",
        props={"title": title},
        children=children,
    )


def map_layout_hint(layout: str) -> str | None:
    """布局描述 → 暗示的根容器类型（用于更精细的结构还原）。

    例：「左右分栏」→ 可能需要 Row/Col；「卡片网格」→ Card 容器。
    P2 仅做 hint，不强制重构（保持组件线性顺序，结构精确还原延后 plan §10）。
    """
    layout_lower = layout.lower()
    if "分栏" in layout_lower or "两栏" in layout_lower or "左右" in layout_lower:
        return "LubanRow"
    if "卡片" in layout_lower or "网格" in layout_lower or "grid" in layout_lower:
        return "LubanCard"
    return None


__all__ = [
    "component_to_node",
    "map_component_type",
    "map_layout_hint",
    "understanding_to_schema",
]
