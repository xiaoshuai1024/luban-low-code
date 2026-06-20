"""P1-T3 表达式沙箱规则校验单测（对齐 expression.ts）。"""

from __future__ import annotations

import pytest

from app.schemas.expression_validator import (
    ExpressionValidationError,
    is_valid_expression,
    validate_expression,
)


@pytest.mark.parametrize(
    "expr",
    [
        "",  # 空表达式合法
        "true",
        "a > 1 && b < 2",
        "user.name",  # 成员访问（合法标识符）
        "items[0]",  # 索引
        "a ? b : c",  # 三元
        "count % 2 === 0",  # 算术 + 严格等
        "'hello ' + name",  # 字符串拼接
    ],
)
def test_valid_expressions(expr: str) -> None:
    validate_expression(expr)  # 不抛即通过
    assert is_valid_expression(expr)


@pytest.mark.parametrize(
    "expr",
    [
        "eval('1+1')",  # eval 黑名单
        "Function('return 1')",  # Function 黑名单
        "new Date()",  # new 作为 id（沙箱 tokenizer 当 id，黑名单拦截）
        "this.foo",  # this 黑名单
        "window.location",  # window 黑名单
        "globalThis.x",  # globalThis 黑名单
        "obj.constructor",  # 成员黑名单
        "obj['__proto__']",  # 索引黑名单
        "fetch('/api')",  # 函数调用（fetch 不是字面量 id）
        "process.env",  # process 黑名单
        "__proto__.x",  # 标识符黑名单
    ],
)
def test_invalid_expressions(expr: str) -> None:
    with pytest.raises(ExpressionValidationError):
        validate_expression(expr)
    assert not is_valid_expression(expr)


def test_unclosed_string_rejected() -> None:
    with pytest.raises(ExpressionValidationError, match="未闭合"):
        validate_expression("'abc")


def test_illegal_char_rejected() -> None:
    with pytest.raises(ExpressionValidationError, match="非法字符"):
        validate_expression("a @ b")


def test_ternary_with_newline_valid() -> None:
    # 跨行空白应被忽略
    validate_expression("a\n?\tb : c")


def test_member_access_to_prototype_rejected() -> None:
    with pytest.raises(ExpressionValidationError):
        validate_expression("x.prototype.toString")
