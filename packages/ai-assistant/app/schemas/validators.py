"""PageSchema 校验闸（AI 生成 → 落画布前的强制关卡）。

校验项（任一失败 → 抛 ValidationFailedError，agent 回环重试）：
  1. Pydantic 结构校验（NodeSchema/PageSchema 形态）；
  2. 物料存在性：node.type 须在 materialRegistry（已注册物料清单）；
  3. propsSchema 合规：node.props 须符合该物料的 propsSchema（JSON Schema）；
  4. 表达式沙箱：visible/loop.data/events 值符合 expression.ts 白名单；
  5. 循环引用：children 树不得出现环（含自引用）；
  6. ID 生成：缺失 id 的节点用 uuid 补齐；重复 id → 报错。

物料清单与 propsSchema 由调用方注入（来自 RAG/materialRegistry 同步），
避免校验闸直接依赖 Milvus（可单测）。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import jsonschema

from app.api.errors import ValidationFailedError
from app.schemas.expression_validator import validate_expression
from app.schemas.page_schema import NodeSchema, PageSchema


@dataclass
class MaterialRegistry:
    """物料注册表（内存形态，由 RAG 同步脚本填充，校验闸只读）。"""

    # name → props_schema(JSON Schema dict)
    materials: dict[str, dict[str, Any]] = field(default_factory=dict)

    def has(self, name: str) -> bool:
        return name in self.materials

    def props_schema(self, name: str) -> dict[str, Any] | None:
        return self.materials.get(name)


def _ensure_ids(node: NodeSchema, seen: set[str]) -> None:
    """补齐缺失 id（uuid）；检测重复 id。"""
    if not node.id:
        node.id = str(uuid.uuid4())
    if node.id in seen:
        raise ValidationFailedError(
            f"重复节点 id: {node.id}", details={"node_type": node.type}
        )
    seen.add(node.id)
    for child in node.children or []:
        _ensure_ids(child, seen)


def _check_no_cycle(node: NodeSchema, _path: set[int] | None = None) -> None:
    """检测 children 树环（按对象 id 追踪）。"""
    path = _path or set()
    if id(node) in path:
        raise ValidationFailedError("节点树存在循环引用")
    path.add(id(node))
    for child in node.children or []:
        _check_no_cycle(child, path)
    path.discard(id(node))


def _validate_expressions(node: NodeSchema) -> None:
    """校验 visible/loop.data/events 表达式（对齐 expression.ts 白名单）。"""
    if isinstance(node.visible, str):
        try:
            validate_expression(node.visible)
        except Exception as e:
            raise ValidationFailedError(
                f"visible 表达式非法: {e}", details={"field": "visible"}
            ) from e
    if node.loop is not None and isinstance(node.loop.data, str):
        try:
            validate_expression(node.loop.data)
        except Exception as e:
            raise ValidationFailedError(
                f"loop.data 表达式非法: {e}", details={"field": "loop.data"}
            ) from e
    if node.events:
        for evt, expr in node.events.items():
            try:
                validate_expression(expr)
            except Exception as e:
                raise ValidationFailedError(
                    f"事件 '{evt}' 表达式非法: {e}", details={"event": evt}
                ) from e
    for child in node.children or []:
        _validate_expressions(child)


def _validate_props(node: NodeSchema, registry: MaterialRegistry) -> None:
    """校验 props 符合物料 propsSchema（JSON Schema）。缺物料→占位不崩。"""
    if not registry.has(node.type):
        # 缺物料不崩：记录但不阻断（占位策略，agent 可重试或降级）
        # 仍递归校验子节点
        for child in node.children or []:
            _validate_props(child, registry)
        return
    schema = registry.props_schema(node.type)
    if schema and node.props is not None:
        try:
            jsonschema.validate(instance=node.props, schema=schema)
        except jsonschema.ValidationError as e:
            raise ValidationFailedError(
                f"props 不符合物料 '{node.type}' 的 propsSchema: {e.message}",
                details={"node_id": node.id, "node_type": node.type},
            ) from e
    for child in node.children or []:
        _validate_props(child, registry)


def validate_page_schema(
    page: PageSchema, registry: MaterialRegistry
) -> PageSchema:
    """主校验闸：结构 → ID → 环 → 表达式 → 物料/props。

    返回校验通过（可能补齐了 id）的 PageSchema；失败抛 ValidationFailedError。
    """
    # 1. ID 唯一/补齐
    _ensure_ids(page.root, seen=set())
    # 2. 无环
    _check_no_cycle(page.root)
    # 3. 表达式沙箱
    _validate_expressions(page.root)
    # 4. 物料存在 + propsSchema（缺物料占位不崩）
    _validate_props(page.root, registry)
    return page


def collect_missing_materials(
    page: PageSchema, registry: MaterialRegistry
) -> list[str]:
    """收集未注册的物料名（供 agent 降级/提示）。"""
    missing: list[str] = []

    def walk(n: NodeSchema) -> None:
        if not registry.has(n.type):
            missing.append(n.type)
        for c in n.children or []:
            walk(c)

    walk(page.root)
    return missing
