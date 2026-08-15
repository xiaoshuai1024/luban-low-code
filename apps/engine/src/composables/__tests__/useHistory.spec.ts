/**
 * useHistory.spec.ts — 撤销/重做栈单测。
 *
 * 覆盖：push/undo/redo/reset、容量上限、snapshot+pushSnapshot 模式、深拷贝快照。
 * 适配新 API：useHistory(current, opts)，方法无参，undo/redo 返回 boolean。
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
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(false)
  })

  it('push 后可 undo，undo 回退 current', () => {
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    h.push() // 压入 v1
    cur.value = schema('v2')
    expect(h.undo()).toBe(true)
    expect(cur.value.root.id).toBe('v1')
    expect(h.canRedo.value).toBe(true)
  })

  it('redo 恢复', () => {
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    h.push()
    cur.value = schema('v2')
    h.undo()
    expect(cur.value.root.id).toBe('v1')
    expect(h.redo()).toBe(true)
    expect(cur.value.root.id).toBe('v2')
  })

  it('新 push 清空 redo 栈', () => {
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    h.push()
    cur.value = schema('v2')
    h.undo()
    expect(h.canRedo.value).toBe(true)
    h.push() // 新变更清空 redo
    expect(h.canRedo.value).toBe(false)
  })

  it('容量上限 50 丢最旧', () => {
    const cur = ref<PageSchema>(schema('v0'))
    const h = useHistory(cur, { limit: 50 })
    for (let i = 0; i < 55; i++) {
      cur.value = schema(`v${i}`)
      h.push()
    }
    // past 截断到 50；可 undo 50 次，第 51 次返回 false
    let undoCount = 0
    while (h.undo()) undoCount++
    expect(undoCount).toBe(50)
  })

  it('snapshot + pushSnapshot 记录变更前快照', () => {
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    const prev = h.snapshot() // 捕获 v1
    cur.value = schema('v2')
    h.pushSnapshot(prev) // 压入 v1（mutate 后落栈）
    expect(h.canUndo.value).toBe(true)
    h.undo()
    expect(cur.value.root.id).toBe('v1')
  })

  it('reset 清空', () => {
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    h.push()
    cur.value = schema('v2')
    h.push()
    h.reset()
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(false)
  })

  it('undo/redo 无栈返回 false', () => {
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    expect(h.undo()).toBe(false)
    expect(h.redo()).toBe(false)
  })

  it('快照深拷贝（不串扰）', () => {
    const cur = ref<PageSchema>(schema('v1'))
    const h = useHistory(cur)
    h.push() // 压入 v1 的 clone
    cur.value.root.id = 'mutated'
    h.undo() // 回退到压入的快照
    expect(cur.value.root.id).toBe('v1')
  })
})
