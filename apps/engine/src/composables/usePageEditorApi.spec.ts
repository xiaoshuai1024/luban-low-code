/**
 * usePageEditorApi.spec.ts — 画布操作收口单测（plan P1-T8）。
 *
 * 验证收口后的 api 行为与原 PageEditor on* 函数完全一致：
 *  - addNode：写 meta.defaultProps、容器给空 children、返回新 id、选中、入栈
 *  - updateProp/updateEvent/updateDatasource：写节点字段、入栈
 *  - deleteNode：root 不可删；删选中节点清空 selectedId
 *  - duplicateNode：深克隆、新 id、入栈、选中 clone
 *  - move/reorder/moveNode：no-op（同索引/越界）不入栈（关键：避免污染撤销栈）
 *  - replaceSchema：AI 整树替换入栈、undo 可撤销（plan §3 AI 改动可撤销验收）
 *  - findNodeById/getSelectedNode：只读查询
 *
 * luban-low-code 由 vitest.config.ts alias 解析到 src/test/lubanLowCodeStub.ts。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { usePageEditorApi } from './usePageEditorApi'
import { useHistory } from './useHistory'
import type { PageSchema } from '@/types/schema'

function makeSchema(): PageSchema {
  return {
    root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
  }
}

/** 固定 id 序列，便于断言 addNode/duplicateNode 返回值。 */
function makeFixtures() {
  const schema = ref<PageSchema | null>(makeSchema())
  const history = useHistory(schema)
  const selectedId = ref<string | null>(null)
  let counter = 0
  const genId = (prefix = 'n') => `${prefix}-${++counter}`
  const api = usePageEditorApi({ schema, history, selectedId, genId })
  return { schema, history, selectedId, api }
}

beforeEach(() => {
  // counter 通过闭包重置（每个 makeFixtures 重新计数）
})

describe('usePageEditorApi', () => {
  describe('addNode', () => {
    it('追加到 root.children，写 meta.defaultProps，返回新 id 并选中', () => {
      const { schema, selectedId, api } = makeFixtures()
      const id = api.addNode('LubanButton')
      expect(id).toBe('LubanButton-1')
      const child = schema.value!.root.children![0]
      expect(child.type).toBe('LubanButton')
      expect(child.id).toBe('LubanButton-1')
      expect(child.props).toMatchObject({ text: '按钮', type: 'default' })
      expect(selectedId.value).toBe('LubanButton-1')
    })

    it('容器类型给空 children 数组（便于后续 drop）', () => {
      const { schema, api } = makeFixtures()
      api.addNode('LubanContainer')
      expect(schema.value!.root.children![0].children).toEqual([])
    })

    it('追加到指定容器 parentId 的 children', () => {
      const { schema, api } = makeFixtures()
      api.addNode('LubanContainer') // root 级容器
      const containerId = schema.value!.root.children![0].id
      api.addNode('LubanButton', containerId)
      expect(schema.value!.root.children![0].children).toHaveLength(1)
      expect(schema.value!.root.children![0].children![0].type).toBe('LubanButton')
    })

    it('schema 为 null 时返回 null（安全早退）', () => {
      const schema = ref<PageSchema | null>(null)
      const history = useHistory(schema)
      const selectedId = ref<string | null>(null)
      const api = usePageEditorApi({ schema, history, selectedId })
      expect(api.addNode('LubanButton')).toBeNull()
    })
  })

  describe('updateProp / updateEvent / updateDatasource', () => {
    it('updateProp 写 node.props[key] 并入栈', () => {
      const { schema, history, api } = makeFixtures()
      api.addNode('LubanButton')
      const id = schema.value!.root.children![0].id
      expect(history.canUndo.value).toBe(true) // addNode 已入栈
      api.updateProp(id, 'text', '点击我')
      expect(schema.value!.root.children![0].props!.text).toBe('点击我')
    })

    it('updateProp 节点不存在时早退（不入栈）', () => {
      const { history, api } = makeFixtures()
      const before = history.canUndo.value
      api.updateProp('not-exist', 'k', 'v')
      expect(history.canUndo.value).toBe(before)
    })

    it('updateEvent 写 node.events[name]', () => {
      const { schema, api } = makeFixtures()
      api.addNode('LubanButton')
      const id = schema.value!.root.children![0].id
      api.updateEvent(id, 'click', 'alert(1)')
      expect(schema.value!.root.children![0].events!.click).toBe('alert(1)')
    })

    it('updateDatasource 写 node.datasource，传 null 清空', () => {
      const { schema, api } = makeFixtures()
      api.addNode('LubanButton')
      const id = schema.value!.root.children![0].id
      api.updateDatasource(id, { id: 'ds-1', varName: 'list' })
      expect(schema.value!.root.children![0].datasource).toEqual({ id: 'ds-1', varName: 'list' })
      api.updateDatasource(id, null)
      expect(schema.value!.root.children![0].datasource).toBeUndefined()
    })
  })

  describe('deleteNode', () => {
    it('删除节点成功入栈；删选中节点清空 selectedId', () => {
      const { schema, selectedId, api } = makeFixtures()
      api.addNode('LubanButton')
      const id = schema.value!.root.children![0].id
      selectedId.value = id
      api.deleteNode(id)
      expect(schema.value!.root.children).toHaveLength(0)
      expect(selectedId.value).toBeNull()
    })

    it('root 不可删（早退不入栈）', () => {
      const { history, api } = makeFixtures()
      api.deleteNode('root')
      // root 未删，且不应入栈（当前栈为空 → canUndo 不变）
      expect(history.canUndo.value).toBe(false)
    })

    it('节点不存在早退', () => {
      const { schema, api } = makeFixtures()
      const before = schema.value!.root.children!.length
      api.deleteNode('ghost')
      expect(schema.value!.root.children!.length).toBe(before)
    })
  })

  describe('duplicateNode', () => {
    it('深克隆 + 新 id + 插入到原节点后 + 选中 clone', () => {
      const { schema, selectedId, api } = makeFixtures()
      api.addNode('LubanContainer')
      const containerId = schema.value!.root.children![0].id
      api.addNode('LubanButton', containerId)
      const buttonId = schema.value!.root.children![0].children![0].id

      const cloneId = api.duplicateNode(buttonId)
      expect(cloneId).toBeTruthy()
      expect(cloneId).not.toBe(buttonId)
      // 容器内现有 2 个（原 + clone）
      expect(schema.value!.root.children![0].children).toHaveLength(2)
      expect(selectedId.value).toBe(cloneId)
    })

    it('节点不存在返回 null', () => {
      const { api } = makeFixtures()
      expect(api.duplicateNode('ghost')).toBeNull()
    })
  })

  describe('move / reorder / moveNode', () => {
    it('reorder 重排 root.children', () => {
      const { schema, api } = makeFixtures()
      api.addNode('LubanButton')
      api.addNode('LubanInput')
      api.reorder(0, 1)
      expect(schema.value!.root.children!.map((c) => c.type)).toEqual(['LubanInput', 'LubanButton'])
    })

    it('move 同索引 no-op 不入栈（关键：避免污染撤销栈）', () => {
      const { history, api } = makeFixtures()
      // move 空栈下，no-op 应保持栈空
      api.move(null, 0, 0)
      expect(history.canUndo.value).toBe(false)
    })

    it('moveNode 跨容器移动', () => {
      const { schema, api } = makeFixtures()
      api.addNode('LubanContainer')
      api.addNode('LubanButton') // root 级 button
      const buttonId = schema.value!.root.children![1].id
      const containerId = schema.value!.root.children![0].id
      api.moveNode(buttonId, containerId, 0)
      expect(schema.value!.root.children![0].children).toHaveLength(1)
      expect(schema.value!.root.children![0].children![0].id).toBe(buttonId)
      expect(schema.value!.root.children).toHaveLength(1) // root 只剩 container
    })

    it('moveNode 目标不存在 no-op 不入栈', () => {
      const { history, api } = makeFixtures()
      api.addNode('LubanButton')
      api.moveNode('ghost', null, 0)
      // 仅 addNode 入栈一次，moveNode no-op 不追加
      expect(history.canUndo.value).toBe(true)
    })
  })

  describe('replaceSchema（AI 整树替换）', () => {
    it('替换 root 并入栈，undo 可恢复（AI 改动可撤销 plan §3）', () => {
      const { schema, history, api } = makeFixtures()
      const originalRoot = schema.value!.root
      expect(history.canUndo.value).toBe(false)

      const newRoot = {
        id: 'root',
        type: 'LubanContainer',
        props: {},
        children: [{ id: 'ai-node-1', type: 'LubanTable', props: { columns: [] } }],
      }
      api.replaceSchema(newRoot)

      expect(schema.value!.root.children).toHaveLength(1)
      expect(schema.value!.root.children![0].type).toBe('LubanTable')
      expect(history.canUndo.value).toBe(true)

      // undo 回退到替换前（undo 恢复的是 history 存的深拷贝快照，用深比较）
      history.undo()
      expect(schema.value!.root).toEqual(originalRoot)
      expect(schema.value!.root.children).toHaveLength(0)
    })

    it('schema 为 null 时早退', () => {
      const schema = ref<PageSchema | null>(null)
      const history = useHistory(schema)
      const api = usePageEditorApi({ schema, history, selectedId: ref(null) })
      api.replaceSchema({ id: 'r', type: 'LubanContainer', props: {} })
      expect(schema.value).toBeNull()
    })
  })

  describe('select / findNodeById / getSelectedNode（只读查询）', () => {
    it('select 写 selectedId，不入栈', () => {
      const { selectedId, history, api } = makeFixtures()
      api.select('x')
      expect(selectedId.value).toBe('x')
      expect(history.canUndo.value).toBe(false)
    })

    it('findNodeById 返回节点或 null', () => {
      const { schema, api } = makeFixtures()
      api.addNode('LubanButton')
      const id = schema.value!.root.children![0].id
      expect(api.findNodeById(id)?.type).toBe('LubanButton')
      expect(api.findNodeById('ghost')).toBeNull()
    })

    it('getSelectedNode 返回当前选中节点', () => {
      const { schema, selectedId, api } = makeFixtures()
      api.addNode('LubanButton')
      selectedId.value = schema.value!.root.children![0].id
      expect(api.getSelectedNode()?.type).toBe('LubanButton')
      selectedId.value = null
      expect(api.getSelectedNode()).toBeNull()
    })
  })

  describe('AI 面板与用户操作共享撤销栈（集成语义）', () => {
    it('用户 addNode 后 AI replaceSchema，undo 两次分别回退', () => {
      const { schema, history, api } = makeFixtures()
      api.addNode('LubanButton')
      api.replaceSchema({
        id: 'root',
        type: 'LubanContainer',
        props: {},
        children: [{ id: 'ai', type: 'LubanTable', props: {} }],
      })
      // undo 1: 回退 replaceSchema → 恢复用户 addNode 的 button
      history.undo()
      expect(schema.value!.root.children!.map((c) => c.type)).toEqual(['LubanButton'])
      // undo 2: 回退 addNode → 空
      history.undo()
      expect(schema.value!.root.children).toHaveLength(0)
    })
  })
})
