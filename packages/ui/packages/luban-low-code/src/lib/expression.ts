/**
 * luban 表达式沙箱引擎（自研轻量）
 *
 * 用途：低代码运行时求值 node.visible / node.loop.data / {{}} 插值等用户表达式。
 *
 * 安全设计（MUST）：
 *  - 递归下降 parser 产出 AST，executor 仅识别白名单节点；
 *  - 禁 eval / Function / new / this / window / globalThis / import —— 全程不调用动态求值；
 *  - 标识符仅从 ctx 取值，无 ctx 时返回 undefined（绝不 fallback 到全局）；
 *  - 不支持任意函数调用（避免调用宿主方法/构造器）；
 *  - 支持的安全操作：字面量 / 标识符 / 成员访问 / 索引 / 一元(! -) /
 *    算术(+ - * / %) / 比较(== != === !== < <= > >=) / 逻辑(&& ||) / 三元(?:)。
 *
 * 对外：evaluate(expr, ctx) 求值单个表达式；interpolate(tpl, ctx) 处理 {{}} 插值。
 */

export type EvalContext = Record<string, unknown>

// ===== AST =====
type AST =
  | { t: 'lit'; v: unknown }
  | { t: 'id'; n: string }
  | { t: 'mem'; o: AST; p: string }
  | { t: 'idx'; o: AST; i: AST }
  | { t: 'un'; op: string; a: AST }
  | { t: 'bin'; op: string; l: AST; r: AST }
  | { t: 'cond'; c: AST; a: AST; b: AST }

// ===== Tokenizer =====
type Tok = { k: string; v: string }
const OPS3 = ['===', '!==']
const OPS2 = ['==', '!=', '<=', '>=', '&&', '||']

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = src.length
  const isDigit = (c: string) => c >= '0' && c <= '9'
  const isIdStart = (c: string) => /[A-Za-z_$]/.test(c)
  const isIdPart = (c: string) => /[A-Za-z0-9_$]/.test(c)
  while (i < n) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let j = i + 1
      while (j < n && (isDigit(src[j]) || src[j] === '.')) j++
      toks.push({ k: 'num', v: src.slice(i, j) }); i = j; continue
    }
    if (c === '"' || c === "'") {
      const quote = c; let j = i + 1; let s = ''
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2 } else { s += src[j]; j++ }
      }
      if (j >= n) throw new Error('未闭合的字符串')
      toks.push({ k: 'str', v: s }); i = j + 1; continue
    }
    if (isIdStart(c)) {
      let j = i + 1
      while (j < n && isIdPart(src[j])) j++
      toks.push({ k: 'id', v: src.slice(i, j) }); i = j; continue
    }
    const three = src.slice(i, i + 3)
    if (OPS3.includes(three)) { toks.push({ k: 'op', v: three }); i += 3; continue }
    const two = src.slice(i, i + 2)
    if (OPS2.includes(two)) { toks.push({ k: 'op', v: two }); i += 2; continue }
    if ('+-*/%<>!?:.[](),'.includes(c)) { toks.push({ k: 'op', v: c }); i++; continue }
    throw new Error(`非法字符: ${c}`)
  }
  return toks
}

// ===== Parser (递归下降) =====
class Parser {
  private p = 0
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined { return this.toks[this.p] }
  private next(): Tok | undefined { return this.toks[this.p++] }
  private eatOp(v: string): boolean {
    const t = this.peek()
    if (t && t.k === 'op' && t.v === v) { this.p++; return true }
    return false
  }
  parse(): AST {
    const node = this.cond()
    if (this.p < this.toks.length) throw new Error('未消费完的 token')
    return node
  }
  private cond(): AST {
    const c = this.logical()
    if (this.eatOp('?')) {
      const a = this.cond()
      if (!this.eatOp(':')) throw new Error('三元缺 :')
      const b = this.cond()
      return { t: 'cond', c, a, b }
    }
    return c
  }
  private logical(): AST {
    let l = this.equality()
    while (true) {
      const t = this.peek()
      if (t && t.k === 'op' && (t.v === '&&' || t.v === '||')) {
        this.next(); const r = this.equality(); l = { t: 'bin', op: t.v, l, r }
      } else break
    }
    return l
  }
  private equality(): AST {
    let l = this.relational()
    while (true) {
      const t = this.peek()
      if (t && t.k === 'op' && ['==', '!=', '===', '!=='].includes(t.v)) {
        this.next(); const r = this.relational(); l = { t: 'bin', op: t.v, l, r }
      } else break
    }
    return l
  }
  private relational(): AST {
    let l = this.additive()
    while (true) {
      const t = this.peek()
      if (t && t.k === 'op' && ['<', '<=', '>', '>='].includes(t.v)) {
        this.next(); const r = this.additive(); l = { t: 'bin', op: t.v, l, r }
      } else break
    }
    return l
  }
  private additive(): AST {
    let l = this.multiplicative()
    while (true) {
      const t = this.peek()
      if (t && t.k === 'op' && (t.v === '+' || t.v === '-')) {
        this.next(); const r = this.multiplicative(); l = { t: 'bin', op: t.v, l, r }
      } else break
    }
    return l
  }
  private multiplicative(): AST {
    let l = this.unary()
    while (true) {
      const t = this.peek()
      if (t && t.k === 'op' && ['*', '/', '%'].includes(t.v)) {
        this.next(); const r = this.unary(); l = { t: 'bin', op: t.v, l, r }
      } else break
    }
    return l
  }
  private unary(): AST {
    const t = this.peek()
    if (t && t.k === 'op' && (t.v === '!' || t.v === '-')) {
      this.next(); return { t: 'un', op: t.v, a: this.unary() }
    }
    return this.postfix()
  }
  private postfix(): AST {
    let node = this.primary()
    while (true) {
      if (this.eatOp('.')) {
        const t = this.next()
        if (!t || t.k !== 'id') throw new Error('. 后须标识符')
        node = { t: 'mem', o: node, p: t.v }
      } else if (this.eatOp('[')) {
        const idx = this.cond()
        if (!this.eatOp(']')) throw new Error('缺 ]')
        node = { t: 'idx', o: node, i: idx }
      } else break
    }
    return node
  }
  private primary(): AST {
    const t = this.next()
    if (!t) throw new Error('意外的表达式结尾')
    if (t.k === 'num') {
      const v = Number(t.v)
      if (Number.isNaN(v)) throw new Error(`非法数字: ${t.v}`)
      return { t: 'lit', v }
    }
    if (t.k === 'str') return { t: 'lit', v: t.v }
    if (t.k === 'id') {
      if (t.v === 'true') return { t: 'lit', v: true }
      if (t.v === 'false') return { t: 'lit', v: false }
      if (t.v === 'null') return { t: 'lit', v: null }
      if (t.v === 'undefined') return { t: 'lit', v: undefined }
      // 禁止访问宿主全局
      if (['window', 'globalThis', 'global', 'this', 'self', 'process', 'eval', 'Function', 'constructor', '__proto__', 'prototype'].includes(t.v)) {
        throw new Error(`禁止访问标识符: ${t.v}`)
      }
      return { t: 'id', n: t.v }
    }
    if (t.k === 'op' && t.v === '(') {
      const inner = this.cond()
      if (!this.eatOp(')')) throw new Error('缺 )')
      return inner
    }
    throw new Error(`意外的 token: ${t.v}`)
  }
}

// ===== Executor =====
/**
 * Member/index access blacklist — complements the identifier-level blacklist in
 * {@link primary}. Without this, `obj.constructor` / `obj['__proto__']` would read
 * the prototype chain and leak host type internals (no function-call syntax means
 * this can't escalate to RCE, but it violates the minimal-exposure sandbox rule).
 * Both the parsed member name (`mem.p`) and the runtime index value (`idx`) are
 * checked because the identifier blacklist only catches bare `constructor` tokens.
 */
const MEMBER_BLACKLIST = new Set(['constructor', '__proto__', 'prototype'])

function exec(node: AST, ctx: EvalContext): unknown {
  switch (node.t) {
    case 'lit': return node.v
    case 'id': return ctx?.[node.n]
    case 'mem': {
      const o = exec(node.o, ctx)
      if (o == null) return undefined
      if (MEMBER_BLACKLIST.has(node.p)) return undefined
      return (o as Record<string, unknown>)[node.p]
    }
    case 'idx': {
      const o = exec(node.o, ctx)
      const i = exec(node.i, ctx)
      if (o == null) return undefined
      if (typeof i === 'string' && MEMBER_BLACKLIST.has(i)) return undefined
      return (o as Record<string, unknown>)[i as string]
    }
    case 'un': {
      const a = exec(node.a, ctx)
      return node.op === '!' ? !a : -((a as number) ?? 0)
    }
    case 'bin': {
      const l = exec(node.l, ctx)
      const r = exec(node.r, ctx)
      switch (node.op) {
        case '+': return (l as number) + (r as number)
        case '-': return (l as number) - (r as number)
        case '*': return (l as number) * (r as number)
        case '/': return (l as number) / (r as number)
        case '%': return (l as number) % (r as number)
        case '==': return l == r // eslint-disable-line eqeqeq
        case '!=': return l != r // eslint-disable-line eqeqeq
        case '===': return l === r
        case '!==': return l !== r
        case '<': return (l as number) < (r as number)
        case '<=': return (l as number) <= (r as number)
        case '>': return (l as number) > (r as number)
        case '>=': return (l as number) >= (r as number)
        case '&&': return l && r
        case '||': return l || r
        default: throw new Error(`未知二元运算: ${node.op}`)
      }
    }
    case 'cond': return exec(node.c, ctx) ? exec(node.a, ctx) : exec(node.b, ctx)
  }
}

/** 求值单个表达式（沙箱）。非法/危险表达式抛错。 */
export function evaluate(expr: string, ctx: EvalContext = {}): unknown {
  const trimmed = expr.trim()
  if (trimmed === '') return undefined
  const toks = tokenize(trimmed)
  const ast = new Parser(toks).parse()
  return exec(ast, ctx)
}

/** {{expr}} Mustache 插值。求值失败的分段保留空串（容错）。 */
export function interpolate(template: string, ctx: EvalContext = {}): string {
  if (typeof template !== 'string') return ''
  return template.replace(/\{\{([^}]*)\}\}/g, (_m, raw: string) => {
    try {
      const v = evaluate(raw.trim(), ctx)
      return v == null ? '' : String(v)
    } catch {
      return ''
    }
  })
}

/** 求值为布尔（visible 等场景）。非法/异常默认 false（不渲染更安全）。 */
export function evaluateBoolean(expr: string | boolean | undefined, ctx: EvalContext = {}): boolean {
  if (expr === undefined || expr === null) return true
  if (typeof expr === 'boolean') return expr
  try {
    return Boolean(evaluate(expr, ctx))
  } catch {
    return false
  }
}
