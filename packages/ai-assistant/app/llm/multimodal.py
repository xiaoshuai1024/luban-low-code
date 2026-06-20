"""llm/multimodal.py — 多模态视觉模型适配（plan P2-T1）。

provider.chat_with_image 已提供基于 OpenAI 兼容协议的默认多模态实现
（HumanMessage 多模态 content + image_url base64），三家视觉模型
（GLM-V / DeepSeek-VL / Qwen-VL）均支持此格式。

本模块补充：
  - 按 MODEL_PROVIDER 解析对应视觉模型名（glm-4v / deepseek-vl2 / qwen-vl-plus）；
  - 厂商若有特殊图片消息格式差异，在此抹平（当前三家均兼容 OpenAI 格式，无差异）。

视觉理解输出模型（喂给 provider.chat_with_image）：DesignUnderstanding。
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field

from app.core.config import ModelProvider, Settings


def vision_model_name(settings: Settings) -> str:
    """按 MODEL_PROVIDER 返回视觉模型名（三家 VL 变体）。"""
    mapping = {
        ModelProvider.GLM: settings.glm_vision_model,
        ModelProvider.DEEPSEEK: settings.deepseek_vision_model,
        ModelProvider.QWEN: settings.qwen_vision_model,
    }
    return mapping.get(settings.model_provider, settings.glm_vision_model)


@dataclass
class VisionModelInfo:
    """视觉模型运行时信息（供 trace/日志展示）。"""

    provider: str
    model: str


def vision_model_info(settings: Settings) -> VisionModelInfo:
    return VisionModelInfo(
        provider=settings.model_provider.value, model=vision_model_name(settings)
    )


class DesignComponent(BaseModel):
    """多模态识别出的单个组件（设计稿→物料映射前的中间态）。"""

    type: str = Field(
        description="识别到的组件类型：table | form | list | nav | menu | tabs | button | text | image | container | unknown"
    )
    description: str = Field(description="组件描述（含文字内容摘要）")
    text: str | None = Field(default=None, description="识别到的文字（若有）")
    uncertain: bool = Field(default=False, description="识别不确定时为 true（→ 占位+标注待确认）")


class DesignUnderstanding(BaseModel):
    """多模态设计稿理解结果（喂给 provider.chat_with_image 的结构化输出模型）。

    由 VLM 读图产出：整体布局 + 组件清单 + 文字。后续 design workflow 的
    map_to_materials 节点把组件映射到 luban 物料。
    """

    layout: str = Field(description="整体布局描述：顶部导航+主体表格 / 左右分栏 / 卡片网格 等")
    components: list[DesignComponent] = Field(description="识别到的组件清单（从上到下、从左到右）")
    title: str | None = Field(default=None, description="页面主标题（若有）")
    summary: str = Field(description="一句话页面概述")


def build_understanding_prompt(known_materials: list[str]) -> list[str]:
    """构造 VLM system prompt（含可用物料清单，引导映射到真实物料）。"""
    return [
        "你是 luban 低代码平台的设计稿理解助手。读图识别页面布局、组件类型和文字。",
        "识别原则：",
        "- 组件类型尽量映射到已知 luban 物料类型；不确定的标 uncertain=true（不强行猜测）；",
        "- 文字由你直接读（不依赖 OCR）；识别到的文字填 text 字段；",
        "- 布局描述要含层级关系（如：顶部导航 / 主体表格 / 底部分页）。",
        f"可用 luban 物料类型：{', '.join(known_materials) if known_materials else '（未提供，按通用 UI 组件识别）'}",
    ]


__all__ = [
    "DesignComponent",
    "DesignUnderstanding",
    "VisionModelInfo",
    "build_understanding_prompt",
    "vision_model_info",
    "vision_model_name",
]
