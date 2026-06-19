/**
 * usePageEditorApi.spec.ts — 画布操作 API 收口单测。
 *
 * 验证：addNode/updateProp/deleteNode/duplicate/applySchema 等正确操作 schema
 * 并 history.push（AI/人工改动入栈可撤销）。
 *
 * luban-low-code 需 mock（dist 未构建，运行时不解析）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import type { PageSchema } from '@/types/schema'

// mock luban-low-code（运行时不可解析）
vi.mock('luban-low-code', () => ({
  getComponentMeta: (type: string) => ({
    type,
    label: type,
    defaultProps: type === 'LubanButton' ? { label: '按钮' } : {},
  }),
  isContainerType: (type: string) => type === 'LubanContainer' || type === 'LubanPage',
  reorderRootChildren: (s: PageSchema, from: number, to: number) => {
    const c = s.root.children!
    const [m] = c.splice(from, 1)
    c.splice(to, 0, m)
  },
}))

import { useHistory } from '@/composables/useHistory'
import { usePageEditorApi } from '@/composables/usePageEditorApi'

function makeSchema(): PageSchema {
  return {
    root: { id: 'root', type: 'LubanPage', props: {}, children: [] },
  }
}

function setup() {
  const schema = ref<PageSchema | null>(makeSchema())
  const history = useHistory()
  const selectedId = ref<string | null>(null)
  const api = usePageEditorApi(schema, history, selectedId)
  return { schema, history, selectedId, api }
}

describe('usePageEditorApi', () => {
  it('addNode 追加到 root.children 并选中', () => {
    const { api, schema } = setup()
    const node = api.addNode('LubanButton')
    expect(node).not.toBeNull()
    expect(schema.value?.root.children).toHaveLength(1)
    expect(schema.value?.root.children[0].type).toBe('LubanButton')
  })

  it('addNode 入撤销栈（source manual）', () => {
    const { api, history, schema } = setup()
    api.addNode('LubanButton')
    expect(history.canUndo.value).toBe(true)
    // undo 后回退到空 children
    const prev = history.undo(schema.value!)
    expect(prev?.root.children).toHaveLength(0)
  })

  it('updateProp 修改属性', () => {
    const { api, schema } = setup()
    const node = api.addNode('LubanButton')
    api.updateProp(node!.id, 'label', '提交')
    expect(schema.value?.root.children[0].props?.label).toBe('提交')
  })

  it('deleteNode 删除', () => {
    const { api, schema } = setup()
    const node = api.addNode('LubanButton')
    const ok = api.deleteNode(node!.id)
    expect(ok).toBe(true)
    expect(schema.value?.root.children).toHaveLength(0)
  })

  it('deleteNode root 不可删', () => {
    const { api } = setup()
    expect(api.deleteNode('root')).toBe(false)
  })

  it('duplicateNode 复制', () => {
    const { api, schema } = setup()
    const node = api.addNode('LubanButton')
    const dup = api.duplicateNode(node!.id)
    expect(dup).not.toBeNull()
    expect(dup?.id).not.toBe(node!.id)
    expect(schema.value?.root.children).toHaveLength(2)
  })

  it('applySchema 整页替换（AI）并入栈', () => {
    const { api, schema, history } = setup()
    const next = makeSchema()
    next.root.children!.push({ id: 'ai1', type: 'LubanButton', props: { label: 'AI' } })
    api.applySchema(next, 'AI 生成页面')
    expect(schema.value?.root.children).toHaveLength(1)
    expect(schema.value?.root.children[0].id).toBe('ai1')
    expect(history.canUndo.value).toBe(true)
    // undo 恢复空页
    const prev = history.undo(schema.value!)
    expect(prev?.root.children).toHaveLength(0)
  })

  it('updateEvent 写 eventBindings', () => {
    const { api, schema } = setup()
    const node = api.addNode('LubanButton')
    api.updateEvent(node!.id, 'click', "navigate('/x')")
    expect(schema.value?.root.children[0].eventBindings?.click).toBe("navigate('/x')")
  })

  it('reorder 重排 root.children', () => {
    const { api, schema } = setup()
    api.addNode('NodeA')
    api.addNode('NodeB')
    expect(schema.value?.root.children.map((c) => c.type)).toEqual(['NodeA', 'NodeB'])
    api.reorder(1, 0)
    // mock reorder 已 swap，校验顺序反转且长度不变
    expect(schema.value?.root.children.map((c) => c.type)).toEqual(['NodeB', 'NodeA'])
    expect(schema.value?.root.children).toHaveLength(2)
  })

  it('select 设置 selectedId', () => {
    const { api, selectedId } = setup()
    api.select('xyz')
    expect(selectedId.value).toBe('xyz')
  })

  it('undo/redo 透传 history', () => {
    const { api, schema } = setup()
    api.addNode('LubanButton')
    expect(schema.value?.root.children).toHaveLength(1)
    api.undo()
    expect(schema.value?.root.children).toHaveLength(0)
    api.redo()
    expect(schema.value?.root.children).toHaveLength(1)
  })
})
