"""PageSchema / NodeSchema 的 Pydantic v2 模型。

严格对齐 luban-low-code schema.ts（single source）：
  NodeSchema { id, type, props?, children?, visible?, loop?, events?, datasource?, locked?, hidden? }
  NodeLoop { data, itemVar?, keyVar? }
  NodeDatasource { id, varName, params? }
  PageSchema { root: NodeSchema, formState? }

AI 生成的 schema 须先过校验闸（validators.py）才能落到画布。
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NodeLoop(BaseModel):
    """循环渲染配置（对齐 schema.ts NodeLoop）。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    data: str | list[Any] = Field(..., description="表达式(求值为数组)或字面量数组")
    item_var: str | None = Field(default="item", alias="itemVar")
    key_var: str | None = Field(default="index", alias="keyVar")


class NodeDatasource(BaseModel):
    """节点数据源绑定（对齐 schema.ts NodeDatasource）。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    var_name: str = Field(..., alias="varName")
    params: dict[str, Any] | None = None


class NodeSchema(BaseModel):
    """画布节点（对齐 schema.ts NodeSchema）。type 须为 materialRegistry 已注册物料。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str | None = None
    type: str
    props: dict[str, Any] | None = None
    children: list[NodeSchema] | None = None
    visible: str | bool | None = None
    loop: NodeLoop | None = None
    events: dict[str, str] | None = None
    datasource: NodeDatasource | None = None
    locked: bool | None = None
    hidden: bool | None = None


class PageSchema(BaseModel):
    """页面 schema：root 节点 + 可选表单状态。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    root: NodeSchema
    form_state: dict[str, Any] | None = Field(default=None, alias="formState")


NodeSchema.model_rebuild()
