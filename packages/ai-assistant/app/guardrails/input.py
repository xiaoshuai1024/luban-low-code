"""输入 guardrail：prompt injection 检测 + PII 脱敏。

injection 检测：基于模式 + 关键词（越狱指令/角色扮演劫持/指令覆盖）。
PII 脱敏：手机号/邮箱/身份证 → 占位，脱敏后才进 LLM/Langfuse（MUST）。

禁假绿：检测规则有真实用例覆盖（合法/恶意边界）。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# prompt injection 特征模式（中英）
_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.I),
    re.compile(r"disregard\s+(the\s+)?(previous|prior)\s+", re.I),
    re.compile(r"you\s+are\s+(now|actually)\s+(a|an)\s+", re.I),  # 角色劫持
    re.compile(r"(reveal|show|print|output)\s+(your\s+)?(system\s+)?prompt", re.I),
    re.compile(r"忽略(以上|之前|前面)(所有)?(指令|提示|规则)", re.I),
    re.compile(r"你现在是|假装你是|扮演", re.I),
    re.compile(r"(输出|显示|打印)你的?(系统)?提示词", re.I),
    re.compile(r"<\|im_start\|>|<\|system\|>|<\s*/?\s*system\s*>", re.I),  # 特殊 token 注入
]

# PII 正则
_PHONE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")  # 中国手机号
_EMAIL = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_IDCARD = re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")  # 18 位身份证
_BANKCARD = re.compile(r"(?<!\d)\d{16,19}(?!\d)")  # 银行卡


@dataclass
class InjectionResult:
    is_injection: bool
    matched_patterns: list[str]
    cleaned_text: str


@dataclass
class PIIScanResult:
    has_pii: bool
    sanitized_text: str
    redactions: list[str]  # 记录脱敏了哪些类型（不含原文！）


def detect_injection(text: str) -> InjectionResult:
    """检测 prompt injection。返回是否命中 + 命中模式 + 原文（不改写）。"""
    matched: list[str] = []
    for pat in _INJECTION_PATTERNS:
        m = pat.search(text)
        if m:
            matched.append(m.group(0))
    return InjectionResult(
        is_injection=bool(matched),
        matched_patterns=matched,
        cleaned_text=text,
    )


def sanitize_pii(text: str) -> PIIScanResult:
    """PII 脱敏：手机/邮箱/身份证/银行卡 → 占位。返回脱敏文本 + 类型清单（无原文）。"""
    redactions: list[str] = []
    out = text

    if _PHONE.search(out):
        out = _PHONE.sub("[手机号]", out)
        redactions.append("phone")
    if _EMAIL.search(out):
        out = _EMAIL.sub("[邮箱]", out)
        redactions.append("email")
    if _IDCARD.search(out):
        out = _IDCARD.sub("[身份证]", out)
        redactions.append("idcard")
    if _BANKCARD.search(out):
        out = _BANKCARD.sub("[银行卡]", out)
        redactions.append("bankcard")

    return PIIScanResult(
        has_pii=bool(redactions), sanitized_text=out, redactions=redactions
    )


def guard_input(text: str) -> tuple[str, InjectionResult, PIIScanResult]:
    """输入闸组合：injection 检测 + PII 脱敏。

    返回 (供 LLM 的文本, injection 结果, pii 结果)。
    调用方根据 injection.is_injection 决定拒绝/告警；PII 始终脱敏。
    """
    inj = detect_injection(text)
    pii = sanitize_pii(text)
    return pii.sanitized_text, inj, pii
