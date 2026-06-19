"""AI 对话式引导：读当前 schema 给"下一步建议"，不编造物料。

引导场景（plan §4.2 第 6 点 / §1 L1）：
  - 空画布 → 建议从核心组件开始
  - 有表单 → 建议加提交按钮/校验
  - 有表格 → 建议加分页/筛选
  - 缺数据源 → 提示绑定 datasource

关键约束：建议基于**当前 schema 实际存在的物料**，不编造 materialRegistry 之外的物料。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.page_schema import NodeSchema, PageSchema


@dataclass
class GuidanceTip:
    """一条引导建议。"""

    level: str  # info | suggestion | warning
    title: str
    detail: str
    """ 可选的下一步动作（前端可一键执行）"""
    action: str | None = None  # e.g. "add:LubanButton" / "edit:..." / "publish"


def _walk(node: NodeSchema, out: list[NodeSchema]) -> None:
    out.append(node)
    for c in node.children or []:
        _walk(c, out)


def _all_nodes(schema: PageSchema) -> list[NodeSchema]:
    out: list[NodeSchema] = []
    _walk(schema.root, out)
    return out


def generate_guidance(
    schema: PageSchema | None,
    known_materials: set[str],
) -> list[GuidanceTip]:
    """基于当前 schema 生成引导建议。不编造物料（仅引用 known_materials 内的）。

    schema=None/空 → 新手引导；有内容 → 结构化建议。
    """
    tips: list[GuidanceTip] = []

    # 空画布引导
    if schema is None or not _has_real_content(schema):
        tips.append(GuidanceTip(
            level="info",
            title="开始构建页面",
            detail="描述你想要的页面，例如『做一个用户列表页』或『添加一个登录表单』，AI 会帮你生成。",
            action=None,
        ))
        if "LubanButton" in known_materials:
            tips.append(GuidanceTip(
                level="suggestion",
                title="从核心组件开始",
                detail="可以先用一个按钮（LubanButton）熟悉画布操作，再逐步扩展。",
                action="add:LubanButton",
            ))
        return tips

    nodes = _all_nodes(schema)
    types = {n.type for n in nodes}

    # 结构化建议：按存在的物料类型给针对性提示
    if "LubanForm" in types and "LubanButton" not in types and "LubanButton" in known_materials:
        tips.append(GuidanceTip(
            level="suggestion",
            title="为表单添加提交按钮",
            detail="检测到表单但没有提交按钮。建议添加一个 LubanButton 作为提交入口。",
            action="add:LubanButton",
        ))

    if "LubanTable" in types and "LubanPagination" not in types and "LubanPagination" in known_materials:
        tips.append(GuidanceTip(
            level="suggestion",
            title="为表格添加分页",
            detail="数据量较大时，建议给表格加分页（LubanPagination）提升体验。",
            action="add:LubanPagination",
        ))

    # 数据源提示：有表格/表单但无 datasource 绑定
    has_data_component = "LubanTable" in types or "LubanForm" in types
    has_datasource = any(n.datasource is not None for n in nodes)
    if has_data_component and not has_datasource:
        tips.append(GuidanceTip(
            level="warning",
            title="考虑绑定数据源",
            detail="当前表格/表单未绑定数据源（datasource）。绑定后可动态拉取数据。",
            action=None,
        ))

    # 持久化提示：未保存
    tips.append(GuidanceTip(
        level="info",
        title="记得保存",
        detail="改动不会自动保存，记得 Ctrl+S 或点击保存按钮持久化到服务端。",
        action="save",
    ))

    # 兜底：若上面无具体建议，给通用下一步
    if not any(t.level == "suggestion" for t in tips):
        tips.append(GuidanceTip(
            level="suggestion",
            title="继续完善页面",
            detail="可以继续描述想要的修改，例如『把标题改成红色』或『在右侧加一个侧边栏』。",
            action=None,
        ))

    return tips


def _has_real_content(schema: PageSchema) -> bool:
    """判断 schema 是否有实际内容（root.children 非空）。"""
    children = schema.root.children or []
    return len(children) > 0


# 引导专用 system prompt（agent guidance 节点用）
GUIDANCE_SYSTEM_PROMPT = (
    "你是 luban 低代码平台的页面引导助手。根据用户当前画布的 schema 状态，"
    "给出下一步操作建议。规则：\n"
    "1. 只建议 luban 已注册的物料，绝不编造不存在的物料名；\n"
    "2. 建议要具体可执行（加什么组件 / 改什么属性 / 是否需保存）；\n"
    "3. 优先指出结构上的缺失（如表单无提交按钮、表格无分页）；\n"
    "4. 语气简洁友好，像资深设计师在旁指导。"
)
