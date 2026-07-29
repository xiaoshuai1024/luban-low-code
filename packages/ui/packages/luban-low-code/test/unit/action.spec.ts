import { describe, it, expect, vi } from 'vitest'
import { parseAction, evalArg, createActionRunner } from '../../src/lib/action'

describe('parseAction', () => {
  it('解析无参动作', () => {
    expect(parseAction('refresh()')).toEqual({ name: 'refresh', argExprs: [] })
  })
  it('解析单参字符串', () => {
    expect(parseAction("navigate('/x')")).toEqual({ name: 'navigate', argExprs: ["'/x'"] })
  })
  it('解析多参（含字符串内逗号）', () => {
    expect(parseAction("setVar('a,b', 1)")).toEqual({ name: 'setVar', argExprs: ["'a,b'", '1'] })
  })
  it('非法格式返回 null', () => {
    expect(parseAction('not an action')).toBeNull()
    expect(parseAction('navigate')).toBeNull()
  })
})

describe('evalArg', () => {
  it('字符串字面量去引号', () => {
    expect(evalArg("'/foo'", {})).toBe('/foo')
    expect(evalArg('"bar"', {})).toBe('bar')
  })
  it('数字/布尔/null 字面量', () => {
    expect(evalArg('42', {})).toBe(42)
    expect(evalArg('-3.14', {})).toBe(-3.14)
    expect(evalArg('true', {})).toBe(true)
    expect(evalArg('null', {})).toBe(null)
  })
  it('变量名从 vars 取值', () => {
    expect(evalArg('foo', { foo: 'val' })).toBe('val')
    expect(evalArg('missing', {})).toBeUndefined()
  })
})

describe('createActionRunner', () => {
  it('navigate 调 ctx.navigate', () => {
    const nav = vi.fn()
    const runner = createActionRunner()
    runner.run("navigate('/home')", { navigate: nav })
    expect(nav).toHaveBeenCalledWith('/home')
  })
  it('setVar 写入 vars', () => {
    const vars: Record<string, unknown> = {}
    createActionRunner().run("setVar('count', 5)", { vars })
    expect(vars.count).toBe(5)
  })
  it('白名单外动作 noop', () => {
    const nav = vi.fn()
    const vars: Record<string, unknown> = {}
    createActionRunner().run("dangerous('x')", { navigate: nav, vars })
    expect(nav).not.toHaveBeenCalled()
    expect(vars).toEqual({})
  })
  it('非法表达式 noop', () => {
    const runner = createActionRunner()
    expect(() => runner.run('garbage', {})).not.toThrow()
  })
})
