import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useHistory } from './useHistory'

describe('useHistory', () => {
  it('初始无可撤销/重做', () => {
    const h = useHistory(ref({ n: 1 }))
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(false)
  })

  it('push 记录快照，undo 回退到前一态', () => {
    const state = ref({ n: 1 })
    const h = useHistory(state)
    h.push()
    state.value = { n: 2 }
    expect(h.canUndo.value).toBe(true)
    expect(h.undo()).toBe(true)
    expect(state.value).toEqual({ n: 1 })
    expect(h.canRedo.value).toBe(true)
  })

  it('redo 前进到后一态', () => {
    const state = ref({ n: 1 })
    const h = useHistory(state)
    h.push()
    state.value = { n: 2 }
    h.undo()
    expect(h.redo()).toBe(true)
    expect(state.value).toEqual({ n: 2 })
    expect(h.canRedo.value).toBe(false)
  })

  it('push 新分支清空 redo（标准 undo/redo 语义）', () => {
    const state = ref({ n: 1 })
    const h = useHistory(state)
    h.push(); state.value = { n: 2 }
    h.undo() // 回到 1，future=[2]
    h.push(); state.value = { n: 3 } // 新分支
    expect(h.canRedo.value).toBe(false)
  })

  it('空栈 undo/redo 返回 false', () => {
    const h = useHistory(ref({ n: 1 }))
    expect(h.undo()).toBe(false)
    expect(h.redo()).toBe(false)
  })

  it('limit 截断最早历史', () => {
    const state = ref(0)
    const h = useHistory(state, { limit: 2 })
    h.push(); state.value = 1
    h.push(); state.value = 2
    h.push(); state.value = 3 // past 超限截断，仅保留最近 2
    h.undo()
    h.undo()
    expect(h.canUndo.value).toBe(false) // 最多回退 2 步
  })

  it('reset 清空全部历史', () => {
    const state = ref({ n: 1 })
    const h = useHistory(state)
    h.push(); state.value = { n: 2 }
    h.reset()
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(false)
  })

  it('快照深拷贝：撤销后修改不影响历史', () => {
    const state = ref({ list: [1, 2] })
    const h = useHistory(state)
    h.push()
    state.value.list.push(3)
    h.undo()
    expect(state.value.list).toEqual([1, 2])
  })
})
