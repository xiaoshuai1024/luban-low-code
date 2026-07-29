/**
 * useHistory.spec.ts — 撤销/重做栈单测。
 *
 * 覆盖：push/undo/redo/clear、容量上限、source 标记、AI 改动可撤销。
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useHistory } from '@/composables/useHistory'
import type { PageSchema } from '@/types/schema'

function schema(id: string, type = 'LubanPage'): PageSchema {
  return { root: { id, type, props: {}, children: [] } }
}

describe('useHistory', () => {
  it('初始态不可 undo/redo', () => {
    const h = useHistory()
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(false)
    expect(h.size.value).toBe(0)
  })

  it('push 后可 undo，undo 返回上一态', () => {
    const h = useHistory()
    const cur = ref(schema('v1'))
    h.push(cur.value)
    cur.value = schema('v2')
    const prev = h.undo(cur.value)
    expect(prev).not.toBeNull()
    expect(prev?.root.id).toBe('v1')
    expect(h.canRedo.value).toBe(true)
  })

  it('redo 恢复', () => {
    const h = useHistory()
    const cur = ref(schema('v1'))
    h.push(cur.value)
    cur.value = schema('v2')
    const prev = h.undo(cur.value)
    expect(prev?.root.id).toBe('v1')
    const next = h.redo(prev!)
    expect(next?.root.id).toBe('v2')
  })

  it('新 push 清空 redo 栈', () => {
    const h = useHistory()
    const cur = ref(schema('v1'))
    h.push(cur.value)
    cur.value = schema('v2')
    h.undo(cur.value)
    expect(h.canRedo.value).toBe(true)
    // 新变更
    h.push(schema('v1'), 'manual')
    expect(h.canRedo.value).toBe(false)
  })

  it('容量上限 50 丢最旧', () => {
    const h = useHistory()
    for (let i = 0; i < 55; i++) h.push(schema(`v${i}`))
    expect(h.size.value).toBe(50)
  })

  it('AI 改动 source 标记', () => {
    const h = useHistory()
    const cur = ref(schema('v1'))
    h.push(cur.value, 'ai', 'AI 生成页面')
    cur.value = schema('v2')
    h.undo(cur.value)
    expect(h.lastUndoneSource.value).toBe('ai')
  })

  it('clear 清空', () => {
    const h = useHistory()
    h.push(schema('v1'))
    h.push(schema('v2'))
    h.clear()
    expect(h.canUndo.value).toBe(false)
    expect(h.size.value).toBe(0)
  })

  it('undo 无栈返回 null', () => {
    const h = useHistory()
    expect(h.undo(schema('v1'))).toBeNull()
  })

  it('快照深拷贝（不串扰）', () => {
    const h = useHistory()
    const cur = ref(schema('v1'))
    h.push(cur.value)
    cur.value.root.id = 'mutated'
    const prev = h.undo(cur.value)
    // 推入的快照应保持原值，不受后续 mutation 影响
    expect(prev?.root.id).toBe('v1')
  })
})
