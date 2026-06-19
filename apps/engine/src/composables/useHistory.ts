/**
 * useHistory.ts — 画布 schema 撤销/重做栈。
 *
 * 用途：PageEditor 的 schema 变更（人工拖拽/属性编辑/AI 生成）统一 push 入栈，
 * 支持 Ctrl+Z 撤销、Ctrl+Shift+Z 重做。AI 改动与人工改动同等可撤销（plan §4.2/Q5）。
 *
 * 设计：
 *   - undoStack 存"变更前"的旧态快照；push(prev) 在每次变更前调用。
 *   - undo(currentSchema)：把当前态存入 redoStack，弹出 undoStack 顶旧态返回。
 *   - redo(currentSchema)：把当前态存入 undoStack，弹出 redoStack 顶返回。
 *   - 深拷贝快照避免引用串扰；容量上限 50。
 *   - 标识 source: 'manual' | 'ai'，供 UI 区分。
 *
 * 不持久化（仅内存）；页面刷新清空（与 engine 现有"手动 Ctrl+S 持久化"一致）。
 */
import { ref, computed } from 'vue'
import type { PageSchema } from '@/types/schema'

export type ChangeSource = 'manual' | 'ai'

interface HistoryEntry {
  schema: PageSchema
  source: ChangeSource
  /** 变更描述（供 UI 撤销提示，如"AI 生成页面"） */
  label?: string
}

const MAX_STACK = 50

export interface UseHistoryReturn {
  canUndo: import('vue').ComputedRef<boolean>
  canRedo: import('vue').ComputedRef<boolean>
  push: (schema: PageSchema, source?: ChangeSource, label?: string) => void
  undo: (currentSchema: PageSchema) => PageSchema | null
  redo: (currentSchema: PageSchema) => PageSchema | null
  clear: () => void
  size: import('vue').ComputedRef<number>
  /** 上一次 undo 来源（供 UI 提示"已撤销 AI 生成"） */
  lastUndoneSource: import('vue').ComputedRef<ChangeSource | null>
}

function clone(schema: PageSchema): PageSchema {
  return JSON.parse(JSON.stringify(schema))
}

export function useHistory() {
  const undoStack = ref<HistoryEntry[]>([])
  const redoStack = ref<HistoryEntry[]>([])
  const lastSource = ref<ChangeSource | null>(null)

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const size = computed(() => undoStack.value.length)
  const lastUndoneSource = computed(() => lastSource.value)

  function push(schema: PageSchema, source: ChangeSource = 'manual', label?: string) {
    undoStack.value.push({ schema: clone(schema), source, label })
    // 新变更 → 清空 redo 栈（标准撤销语义）
    redoStack.value = []
    if (undoStack.value.length > MAX_STACK) {
      undoStack.value.shift()
    }
  }

  function undo(currentSchema: PageSchema): PageSchema | null {
    const entry = undoStack.value.pop()
    if (!entry) return null
    // 当前态入 redo
    redoStack.value.push({ schema: clone(currentSchema), source: entry.source, label: entry.label })
    lastSource.value = entry.source
    return clone(entry.schema)
  }

  function redo(currentSchema: PageSchema): PageSchema | null {
    const entry = redoStack.value.pop()
    if (!entry) return null
    undoStack.value.push({ schema: clone(currentSchema), source: entry.source, label: entry.label })
    return clone(entry.schema)
  }

  function clear() {
    undoStack.value = []
    redoStack.value = []
    lastSource.value = null
  }

  return { canUndo, canRedo, push, undo, redo, clear, size, lastUndoneSource }
}
