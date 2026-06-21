/**
 * lubanLowCodeStub.ts — engine 本地测试 stub，模拟 luban-low-code 的运行时导出。
 *
 * 背景：engine node_modules 中 luban-low-code 是指向 luban-ui 源码包的 symlink，
 * dist 未构建，运行时（vite dev / vitest）无法解析。vitest.config.ts 把
 * `luban-low-code` alias 到本文件，使 PageEditor.vue 的 `import { ... } from 'luban-low-code'`
 * 在测试环境解析到本 stub。
 *
 * 生产 build（vite build）走 vite.config.ts，不经此 alias，由真实 node_modules 解析。
 *
 * 本 stub 提供：
 *   - LubanDesigner / LubanPage 占位组件（渲染标记 div，并把 emit hooks 暴露给测试）
 *   - getComponentMeta / getPaletteGroups / reorderRootChildren / isContainerType
 *     行为与真实实现一致的最小子集
 *
 * 测试通过 resetLubanStub() 在 beforeEach 重置 hooks 与 fixtures。
 */
import { defineComponent, h, type Component } from 'vue'

export interface MetaFixture {
  label?: string
  defaultProps?: Record<string, unknown>
  isContainer?: boolean
}

/** 默认物料 meta fixture；测试可覆盖。 */
export const metaFixture: Record<string, MetaFixture> = {
  LubanButton: { label: '按钮', defaultProps: { text: '按钮', type: 'default' } },
  LubanInput: { label: '输入框', defaultProps: { placeholder: '请输入' } },
  LubanContainer: { label: '容器', defaultProps: {}, isContainer: true },
}

/**
 * emit hooks：PageEditor 在模板上为 LubanDesigner 绑定 @select/@add-node/@reorder。
 * 测试无法直接拿到组件实例的 emit，故 stub 内部把每次 setup 捕获的 emit 函数
 * 注册到这里，供测试触发（模拟画布点击/拖入/排序）。
 */
export const designerEmitHooks: {
  select: ((id: string | null) => void) | null
  addNode: ((type: string, parentId?: string) => void) | null
  reorder: ((from: number, to: number) => void) | null
} = { select: null, addNode: null, reorder: null }

/** 最近一次 LubanDesigner 收到的 props（供断言 design-mode/schema）。 */
export const designerPropsHolder: { current: Record<string, unknown> | null } = {
  current: null,
}

export function resetLubanStub(): void {
  designerEmitHooks.select = null
  designerEmitHooks.addNode = null
  designerEmitHooks.reorder = null
  designerPropsHolder.current = null
}

export const LubanDesigner = defineComponent({
  name: 'LubanDesignerStub',
  props: {
    schema: { type: Object, default: null },
    designMode: { type: Boolean, default: false },
    showToolbar: { type: Boolean, default: true },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:schema', 'select', 'add-node', 'reorder'],
  setup(props, { emit }) {
    designerPropsHolder.current = props
    designerEmitHooks.select = (id) => emit('select', id)
    designerEmitHooks.addNode = (type, parentId) => emit('add-node', type, parentId)
    designerEmitHooks.reorder = (from, to) => emit('reorder', from, to)
    return () =>
      h('div', {
        class: 'designer-stub',
        'data-design-mode': String(props.designMode),
      })
  },
}) as unknown as Component

export const LubanPage = defineComponent({
  name: 'LubanPageStub',
  props: { schema: { type: Object, default: null } },
  setup(props) {
    return () => h('div', { class: 'page-stub' }, JSON.stringify(props.schema?.root?.id ?? ''))
  },
}) as unknown as Component

export function getComponentMeta(type: string) {
  const m = metaFixture[type]
  if (!m) return undefined
  return {
    name: type,
    label: m.label ?? type,
    defaultProps: m.defaultProps,
    propSchema: {},
  }
}

export function getPaletteGroups() {
  return [
    {
      category: '基础',
      items: [
        { type: 'LubanButton', label: '按钮' },
        { type: 'LubanInput', label: '输入框' },
      ],
    },
  ]
}

export function reorderRootChildren(
  schema: { root: { children?: unknown[] } },
  fromIdx: number,
  toIdx: number,
): void {
  const children = schema.root.children
  if (!children) return
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= children.length || toIdx >= children.length) return
  const [moved] = children.splice(fromIdx, 1)
  children.splice(toIdx, 0, moved)
}

export function isContainerType(type: string): boolean {
  return metaFixture[type]?.isContainer === true
}

// 兼容 PageEditor 未直接使用但可能被间接引用的导出（占位）
export const canAcceptChild = (type: string): boolean => isContainerType(type)

// === V2-T4 响应式纯逻辑（与 luban-low-code 真实实现一致的最小子集）===
export const BREAKPOINTS = { tablet: 1024, mobile: 768 } as const

export function resolveResponsiveProps(
  node: { style?: Record<string, string>; responsive?: { tablet?: Record<string, string>; mobile?: Record<string, string> } },
  breakpoint: 'desktop' | 'tablet' | 'mobile'
): Record<string, string> {
  const desktop = { ...(node.style ?? {}) }
  if (breakpoint === 'desktop') return desktop
  const responsive = node.responsive ?? {}
  if (breakpoint === 'tablet') {
    return { ...desktop, ...(responsive.tablet ?? {}) }
  }
  return { ...desktop, ...(responsive.tablet ?? {}), ...(responsive.mobile ?? {}) }
}

export function hasResponsiveOverrides(node: { responsive?: { tablet?: Record<string, string>; mobile?: Record<string, string> } }): boolean {
  const r = node.responsive
  if (!r) return false
  return (r.tablet ? Object.keys(r.tablet).length : 0) + (r.mobile ? Object.keys(r.mobile).length : 0) > 0
}

function toKebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
}

function styleToDecls(style: Record<string, string>): string {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${toKebab(k)}: ${v};`)
    .join(' ')
}

export function nodeResponsiveCss(node: { id: string; responsive?: { tablet?: Record<string, string>; mobile?: Record<string, string> } }): string {
  if (!node.responsive) return ''
  const selector = `[data-lb-node="${node.id}"]`
  const rules: string[] = []
  if (node.responsive.tablet && Object.keys(node.responsive.tablet).length > 0) {
    const decls = styleToDecls(node.responsive.tablet)
    if (decls) rules.push(`@media (max-width: ${BREAKPOINTS.tablet}px) { ${selector} { ${decls} } }`)
  }
  if (node.responsive.mobile && Object.keys(node.responsive.mobile).length > 0) {
    const decls = styleToDecls(node.responsive.mobile)
    if (decls) rules.push(`@media (max-width: ${BREAKPOINTS.mobile}px) { ${selector} { ${decls} } }`)
  }
  return rules.join('\n')
}

export function treeResponsiveCss(root: { responsive?: { tablet?: Record<string, string>; mobile?: Record<string, string> }; children?: unknown[] }): string {
  const parts: string[] = []
  function walk(node: { id?: string; responsive?: { tablet?: Record<string, string>; mobile?: Record<string, string> }; children?: unknown[] }): void {
    if (node.id) {
      const css = nodeResponsiveCss(node as { id: string; responsive?: { tablet?: Record<string, string>; mobile?: Record<string, string> } })
      if (css) parts.push(css)
    }
    if (node.children) {
      for (const c of node.children) walk(c as { id?: string; responsive?: { tablet?: Record<string, string>; mobile?: Record<string, string> }; children?: unknown[] })
    }
  }
  walk(root)
  return parts.join('\n')
}
