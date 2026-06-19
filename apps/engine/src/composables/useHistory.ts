import { computed, ref, type Ref } from 'vue'

/**
 * useHistory — 撤销/重做历史栈（深拷贝快照）。
 *
 * 用法：在每次 schema mutation 前 push()（记录变更前快照），undo/redo 切换 current。
 * push 后开新分支，清空 future（标准 undo/redo 语义）。
 *
 * @param current 响应式状态引用（如 PageEditor 的 schema ref）
 * @param opts.limit 最大历史步数，默认 50（防内存膨胀）
 */
export interface HistoryOptions {
  limit?: number
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function useHistory<T>(current: Ref<T>, opts: HistoryOptions = {}) {
  const limit = opts.limit ?? 50
  const past = ref<T[]>([]) as Ref<T[]>
  const future = ref<T[]>([]) as Ref<T[]>

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  /** 在 mutation 前调用：把当前状态压入 past，并清空 redo 分支 */
  function push(): void {
    past.value.push(clone(current.value))
    if (past.value.length > limit) past.value.shift()
    future.value = []
  }

  /** 撤销：当前压入 future，回退到 past 栈顶。空栈返回 false */
  function undo(): boolean {
    if (past.value.length === 0) return false
    future.value.push(clone(current.value))
    current.value = past.value.pop() as T
    return true
  }

  /** 重做：当前压入 past，前进到 future 栈顶。空栈返回 false */
  function redo(): boolean {
    if (future.value.length === 0) return false
    past.value.push(clone(current.value))
    current.value = future.value.pop() as T
    return true
  }

  /** 清空历史（如加载新页面后重置） */
  function reset(): void {
    past.value = []
    future.value = []
  }

  return { canUndo, canRedo, push, undo, redo, reset }
}
