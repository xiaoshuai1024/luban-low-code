/**
 * action.ts — 事件动作执行器（W1-T4 events layer）
 *
 * 节点 events: Record<事件名, 动作表达式>，动作表达式形如：
 *   navigate('/x')  ·  alert('hi')  ·  setVar('key', value)
 *
 * 运行时由 RuntimeRenderer 在事件触发时调用 actionRunner.run(expr, ctx)。
 * 安全：仅识别白名单动作（navigate/alert/setVar），不做任意求值；
 *       参数求值仅支持字面量 + 变量名取值，禁 eval/Function。
 */

export interface ActionContext {
  /** navigate 动作目标（host 注入 router.push 等） */
  navigate?: (path: string) => void
  /** setVar 动作的变量容器 */
  vars?: Record<string, unknown>
}

export interface ActionRunner {
  run(actionExpr: string, ctx: ActionContext): void
}

/** 解析 "name(arg1, arg2)" → { name, argExprs }；非法返回 null */
export function parseAction(expr: string): { name: string; argExprs: string[] } | null {
  const m = expr.trim().match(/^(\w+)\s*\((.*)\)\s*$/)
  if (!m) return null
  const name = m[1]
  const argsRaw = m[2].trim()
  if (argsRaw === '') return { name, argExprs: [] }
  // 第一版按逗号分割（不处理嵌套逗号/字符串内逗号，覆盖常见用例）
  return { name, argExprs: splitArgs(argsRaw) }
}

/** 简单逗号分割，忽略引号内的逗号 */
function splitArgs(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let inStr: string | null = null
  for (const ch of s) {
    if (inStr) {
      cur += ch
      if (ch === inStr) inStr = null
    } else if (ch === '"' || ch === "'") {
      inStr = ch
      cur += ch
    } else if (ch === ',') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim() !== '' || out.length > 0) out.push(cur.trim())
  return out
}

/** 求值单个参数：字面量(字符串/数字/布尔) 或 变量名取值 */
export function evalArg(argExpr: string, vars: Record<string, unknown>): unknown {
  const e = argExpr.trim()
  if (/^['"].*['"]$/.test(e)) return e.slice(1, -1)
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e)
  if (e === 'true') return true
  if (e === 'false') return false
  if (e === 'null') return null
  return vars[e] // 变量名
}

const ALLOWED_ACTIONS = new Set(['navigate', 'alert', 'setVar'])

export function createActionRunner(): ActionRunner {
  return {
    run(actionExpr: string, ctx: ActionContext): void {
      const parsed = parseAction(actionExpr)
      if (!parsed) return
      if (!ALLOWED_ACTIONS.has(parsed.name)) return // 白名单：未知动作 noop
      const vars = ctx.vars ?? {}
      const args = parsed.argExprs.map((a) => evalArg(a, vars))
      switch (parsed.name) {
        case 'navigate':
          if (ctx.navigate && typeof args[0] === 'string') ctx.navigate(args[0])
          break
        case 'alert':
          if (typeof window !== 'undefined') window.alert(String(args[0] ?? ''))
          break
        case 'setVar':
          if (typeof args[0] === 'string') vars[args[0]] = args[1]
          break
      }
    },
  }
}
