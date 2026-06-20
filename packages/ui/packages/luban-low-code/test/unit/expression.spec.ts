import { describe, it, expect } from 'vitest'
import { evaluate, interpolate, evaluateBoolean } from '../../src/lib/expression'

describe('evaluate — 沙箱表达式求值', () => {
  it('字面量: 数字/字符串/布尔/null/undefined', () => {
    expect(evaluate('1')).toBe(1)
    expect(evaluate('3.14')).toBe(3.14)
    expect(evaluate('"hello"')).toBe('hello')
    expect(evaluate(" 'x' ")).toBe('x')
    expect(evaluate('true')).toBe(true)
    expect(evaluate('false')).toBe(false)
    expect(evaluate('null')).toBe(null)
    expect(evaluate('undefined')).toBe(undefined)
  })

  it('标识符从 ctx 取值，无 ctx 返回 undefined（不 fallback 全局）', () => {
    expect(evaluate('user.name', { user: { name: 'alice' } })).toBe('alice')
    expect(evaluate('user.name', {})).toBe(undefined)
    expect(evaluate('user.name', { user: null })).toBe(undefined)
  })

  it('索引访问 [n] 与表达式索引', () => {
    expect(evaluate('list[0]', { list: [10, 20] })).toBe(10)
    expect(evaluate('list[1+1]', { list: [10, 20, 30] })).toBe(30)
  })

  it('成员访问 .length 等', () => {
    expect(evaluate('items.length', { items: [1, 2, 3] })).toBe(3)
    expect(evaluate('obj.a.b', { obj: { a: { b: 'deep' } } })).toBe('deep')
  })

  it('算术 + - * / % 与优先级', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7)
    expect(evaluate('(1 + 2) * 3')).toBe(9)
    expect(evaluate('10 % 3')).toBe(1)
  })

  it('比较 == === != !== < <= > >=', () => {
    expect(evaluate('count > 0', { count: 5 })).toBe(true)
    expect(evaluate('count <= 0', { count: 0 })).toBe(true)
    expect(evaluate('a === b', { a: 1, b: 1 })).toBe(true)
    expect(evaluate('a !== b', { a: 1, b: '1' })).toBe(true)
  })

  it('逻辑 && || 与一元 !', () => {
    expect(evaluate('a && b', { a: true, b: false })).toBe(false)
    expect(evaluate('a || b', { a: false, b: 'x' })).toBe('x')
    expect(evaluate('!done', { done: false })).toBe(true)
    expect(evaluate('-n', { n: 5 })).toBe(-5)
  })

  it('三元 a ? b : c', () => {
    expect(evaluate('ok ? "y" : "n"', { ok: true })).toBe('y')
    expect(evaluate('count > 0 ? "pos" : "non"', { count: -1 })).toBe('non')
  })

  it('空表达式返回 undefined', () => {
    expect(evaluate('')).toBe(undefined)
    expect(evaluate('   ')).toBe(undefined)
  })

  it('沙箱：禁止访问危险宿主标识符', () => {
    for (const danger of ['window', 'globalThis', 'global', 'this', 'self', 'process', 'eval', 'Function', 'constructor', '__proto__', 'prototype']) {
      expect(() => evaluate(danger), `应禁止 ${danger}`).toThrow()
    }
  })

  it('沙箱：不支持函数调用语法（防任意调用）', () => {
    expect(() => evaluate('foo()')).toThrow()
  })

  it('沙箱：成员访问禁用 constructor/__proto__/prototype（堵原型链泄露）', () => {
    const ctx = { user: { name: 'a' } }
    // mem (dot) access — each must return undefined rather than the prototype
    expect(evaluate('user.constructor', ctx)).toBe(undefined)
    expect(evaluate('user.__proto__', ctx)).toBe(undefined)
    expect(evaluate('user.prototype', ctx)).toBe(undefined)
    // idx (bracket) access — same blacklist applied at runtime
    expect(evaluate('user["constructor"]', ctx)).toBe(undefined)
    expect(evaluate('user["__proto__"]', ctx)).toBe(undefined)
    expect(evaluate('user["prototype"]', ctx)).toBe(undefined)
    // normal member/index access still works
    expect(evaluate('user.name', ctx)).toBe('a')
    expect(evaluate('user["name"]', ctx)).toBe('a')
  })
})

describe('interpolate — {{}} Mustache 插值', () => {
  it('基本插值', () => {
    expect(interpolate('hi {{user.name}}', { user: { name: 'a' } })).toBe('hi a')
    expect(interpolate('{{a}}+{{b}}={{c}}', { a: 1, b: 2, c: 3 })).toBe('1+2=3')
  })
  it('null 值渲染为空串', () => {
    expect(interpolate('name:{{user.name}}', { user: { name: null } })).toBe('name:')
  })
  it('求值失败容错为空（不抛错破坏整串）', () => {
    expect(interpolate('{{window}}', {})).toBe('')
    expect(interpolate('{{@bad}}', {})).toBe('')
  })
  it('非字符串入参容错', () => {
    expect(interpolate(undefined as unknown as string, {})).toBe('')
    expect(interpolate(null as unknown as string, {})).toBe('')
  })
})

describe('evaluateBoolean — visible 求值', () => {
  it('undefined/null 默认 true（缺省=渲染）', () => {
    expect(evaluateBoolean(undefined)).toBe(true)
    expect(evaluateBoolean(null)).toBe(true)
  })
  it('布尔字面直传', () => {
    expect(evaluateBoolean(false)).toBe(false)
    expect(evaluateBoolean(true)).toBe(true)
  })
  it('表达式求值', () => {
    expect(evaluateBoolean('count > 0', { count: 5 })).toBe(true)
    expect(evaluateBoolean('count > 0', { count: 0 })).toBe(false)
  })
  it('危险/异常表达式默认 false（不渲染更安全）', () => {
    expect(evaluateBoolean('window')).toBe(false)
    expect(evaluateBoolean('@#bad')).toBe(false)
  })
})
