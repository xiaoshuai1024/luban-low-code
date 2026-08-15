/**
 * usePageEditorApi.spec.ts — 画布操作 API 收口单测。
 *
 * 适配新 API：usePageEditorApi({ schema, history, selectedId })，history 经
 * snapshot/pushSnapshot 落栈；deleteNode 返回 void；replaceSchema 整页替换；
 * event 字段为 events（非旧 eventBindings）；api 不再暴露 undo/redo（用 history）。
 *
 * luban-low-code 需 mock（dist 未构建，运行时不解析）。
 */
import { describe, it, expect, vi } from 'vitest'
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
  return { root: { id: 'root', type: 'LubanPage', props: {}, children: [] } }
}

function setup() {
  const schema = ref<PageSchema | null>(makeSchema())
  const history = useHistory(schema)
  const selectedId = ref<string | null>(null)
  const api = usePageEditorApi({ schema, history, selectedId })
  return { schema, history, selectedId, api }
}

describe('usePageEditorApi', () => {
  it('addNode 追加到 root.children 并选中', () => {
    const { api, schema, selectedId } = setup()
    const nodeId = api.addNode('LubanButton')
    expect(nodeId).not.toBeNull()
    expect(schema.value?.root.children).toHaveLength(1)
    expect(schema.value?.root.children[0].type).toBe('LubanButton')
    expect(selectedId.value).toBe(nodeId)
  })

  it('addNode 入撤销栈', () => {
    const { api, history, schema } = setup()
    api.addNode('LubanButton')
    expect(history.canUndo.value).toBe(true)
    history.undo()
    expect(schema.value?.root.children).toHaveLength(0)
  })

  it('updateProp 修改属性', () => {
    const { api, schema } = setup()
    const nodeId = api.addNode('LubanButton')
    api.updateProp(nodeId!, 'label', '提交')
    expect(schema.value?.root.children[0].props?.label).toBe('提交')
  })

  it('deleteNode 删除', () => {
    const { api, schema } = setup()
    const nodeId = api.addNode('LubanButton')
    api.deleteNode(nodeId!)
    expect(schema.value?.root.children).toHaveLength(0)
  })

  it('deleteNode root 不可删', () => {
    const { api, schema } = setup()
    api.deleteNode('root')
    expect(schema.value?.root.id).toBe('root')
    expect(schema.value?.root.children).toHaveLength(0)
  })

  it('duplicateNode 复制', () => {
    const { api, schema } = setup()
    const nodeId = api.addNode('LubanButton')
    const dup = api.duplicateNode(nodeId!)
    expect(dup).not.toBeNull()
    expect(dup?.id).not.toBe(nodeId)
    expect(schema.value?.root.children).toHaveLength(2)
  })

  it('replaceSchema 整页替换（AI）并入栈', () => {
    const { api, schema, history } = setup()
    const newRoot = {
      id: 'root2',
      type: 'LubanPage',
      props: {},
      children: [{ id: 'ai1', type: 'LubanButton', props: { label: 'AI' } }],
    }
    api.replaceSchema(newRoot)
    expect(schema.value?.root.id).toBe('root2')
    expect(schema.value?.root.children[0].id).toBe('ai1')
    expect(history.canUndo.value).toBe(true)
    history.undo()
    expect(schema.value?.root.id).toBe('root')
  })

  it('updateEvent 写 events', () => {
    const { api, schema } = setup()
    const nodeId = api.addNode('LubanButton')
    api.updateEvent(nodeId!, 'click', "navigate('/x')")
    expect(schema.value?.root.children[0].events?.click).toBe("navigate('/x')")
  })

  it('reorder 重排 root.children', () => {
    const { api, schema } = setup()
    api.addNode('NodeA')
    api.addNode('NodeB')
    expect(schema.value?.root.children.map((c) => c.type)).toEqual(['NodeA', 'NodeB'])
    api.reorder(1, 0)
    expect(schema.value?.root.children.map((c) => c.type)).toEqual(['NodeB', 'NodeA'])
    expect(schema.value?.root.children).toHaveLength(2)
  })

  it('select 设置 selectedId', () => {
    const { api, selectedId } = setup()
    api.select('xyz')
    expect(selectedId.value).toBe('xyz')
  })

  it('history undo/redo 可回退/重做 addNode', () => {
    const { api, schema, history } = setup()
    api.addNode('LubanButton')
    expect(schema.value?.root.children).toHaveLength(1)
    history.undo()
    expect(schema.value?.root.children).toHaveLength(0)
    history.redo()
    expect(schema.value?.root.children).toHaveLength(1)
  })
})
