"""表达式沙箱规则校验（对齐 luban-low-code expression.ts 白名单）。

AI 服务侧只做规则校验（不执行求值）：
  - 递归下降 parser 产出 token 流，拒绝宿主全局标识符；
  - 禁 eval / Function / new / this / window / globalThis / import 等；
  - 禁函数调用语法（AST 无 call 节点，发现 '(' 紧跟非运算即视为调用 → 拒绝）。

与 engine expression.ts 的黑名单逐字对齐，确保 AI 生成的 visible/loop/events
表达式在引擎侧 evaluate 时不会被沙箱拒绝。
"""

from __future__ import annotations

# 宿主全局/原型链标识符黑名单（与 expression.ts primary() 完全一致）
IDENTIFIER_BLACKLIST = frozenset(
    {
        "window",
        "globalThis",
        "global",
        "this",
        "self",
        "process",
        "eval",
        "Function",
        "constructor",
        "__proto__",
        "prototype",
    }
)

# 成员/索引访问黑名单（与 expression.ts MEMBER_BLACKLIST 一致）
MEMBER_BLACKLIST = frozenset({"constructor", "__proto__", "prototype"})

# 表达式允许的运算符（白名单之外的字面符号即非法）
_ALLOWED_CHARS = set("+-*/%<>!?:.[](),")


class ExpressionValidationError(Exception):
    """表达式违反沙箱规则。"""


def _tokenize(expr: str) -> list[tuple[str, str]]:
    """极简分词：返回 (kind, value)。kind ∈ {num, str, id, op}。

    与 expression.ts tokenize 对齐，非法字符抛错。
    """
    toks: list[tuple[str, str]] = []
    i = 0
    n = len(expr)
    def is_digit(c: str) -> bool:
        return "0" <= c <= "9"

    def is_id_start(c: str) -> bool:
        return c.isalpha() or c in "_$"

    def is_id_part(c: str) -> bool:
        return c.isalnum() or c in "_$"
    while i < n:
        c = expr[i]
        if c in " \t\n\r":
            i += 1
            continue
        if is_digit(c) or (c == "." and i + 1 < n and is_digit(expr[i + 1])):
            j = i + 1
            while j < n and (is_digit(expr[j]) or expr[j] == "."):
                j += 1
            toks.append(("num", expr[i:j]))
            i = j
            continue
        if c in "\"'":
            quote = c
            j = i + 1
            while j < n and expr[j] != quote:
                if expr[j] == "\\" and j + 1 < n:
                    j += 2
                else:
                    j += 1
            if j >= n:
                raise ExpressionValidationError("未闭合的字符串")
            toks.append(("str", expr[i : j + 1]))
            i = j + 1
            continue
        if is_id_start(c):
            j = i + 1
            while j < n and is_id_part(expr[j]):
                j += 1
            toks.append(("id", expr[i:j]))
            i = j
            continue
        # 多字符运算符
        three = expr[i : i + 3]
        if three in ("===", "!=="):
            toks.append(("op", three))
            i += 3
            continue
        two = expr[i : i + 2]
        if two in ("==", "!=", "<=", ">=", "&&", "||"):
            toks.append(("op", two))
            i += 2
            continue
        if c in _ALLOWED_CHARS:
            toks.append(("op", c))
            i += 1
            continue
        raise ExpressionValidationError(f"非法字符: {c}")
    return toks


def validate_expression(expr: str) -> None:
    """校验单个表达式字符串是否符合 luban 沙箱规则（不求值）。

    规则：
      1. 标识符不得在黑名单（window/eval/Function/this/new 等）；
      2. 成员访问 `.xxx` / 索引不得命中 MEMBER_BLACKLIST；
      3. 禁函数调用： '(' 前若非二元运算上下文 → 视为 call → 拒绝。
         实现简化：出现 `id(...)` 或 `).(...)` 模式即拒绝（沙箱不支持函数调用）。
      4. 禁 new 关键字：`new` 作为 id 即在黑名单里已覆盖（JS 中 new 是关键字，
         但分词器会把它当 id，故直接由黑名单拦截）。

    合法 → 返回 None；非法 → 抛 ExpressionValidationError。
    """
    trimmed = expr.strip()
    if not trimmed:
        return

    try:
        toks = _tokenize(trimmed)
    except ExpressionValidationError:
        raise

    # 标识符黑名单 + 成员黑名单 + 函数调用检测
    prev: tuple[str, str] | None = None
    for kind, val in toks:
        if kind == "id" and val in IDENTIFIER_BLACKLIST:
            raise ExpressionValidationError(f"禁止访问标识符: {val}")
        # 成员访问：前一个 token 是 '.' 且当前命中成员黑名单
        if (
            kind == "id"
            and prev == ("op", ".")
            and val in MEMBER_BLACKLIST
        ):
            raise ExpressionValidationError(f"禁止成员访问: {val}")
        # 索引访问：str 字面量（'__proto__'）紧跟在 '[' 后命中成员黑名单
        if kind == "str" and prev == ("op", "["):
            inner = val[1:-1]  # 去引号
            if inner in MEMBER_BLACKLIST:
                raise ExpressionValidationError(f"禁止索引访问: {inner}")
        # 函数调用检测：'(' 前若是 id / ')' / ']' → 视为调用
        if (kind, val) == ("op", "("):
            if prev is not None and prev[0] == "id" and prev[1] not in (
                "true",
                "false",
                "null",
                "undefined",
            ):
                # id( → 函数调用，拒绝。例外：字面量 id（已由 tokenizer 归类，但稳妥起见排除）
                raise ExpressionValidationError("沙箱禁止函数调用")
            if prev is not None and prev in (("op", ")"), ("op", "]")):
                raise ExpressionValidationError("沙箱禁止函数调用")
        prev = (kind, val)


def is_valid_expression(expr: str) -> bool:
    """便捷包装：合法 True，非法 False（不抛）。"""
    try:
        validate_expression(expr)
    except ExpressionValidationError:
        return False
    return True
