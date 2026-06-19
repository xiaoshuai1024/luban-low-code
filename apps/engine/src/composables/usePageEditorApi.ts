/**
 * usePageEditorApi.ts — 画布操作 API 收口。
 *
 * 收口 PageEditor 原有的私有 setup 函数（onAddNode/onUpdateProp/onDeleteNode/
 * onDuplicateNode/onMove/onReorder/onSelect），解决 stores/page.ts 与 PageEditor
 * 局部 schema 分裂隐患：统一经此 composable 操作 schema + history.push。
 *
 * 契约（plan §9.5）：
 *   usePageEditorApi(schema, history) →
 *     { addNode, updateProp, updateEvent, deleteNode, duplicateNode,
 *       applyPatch, applySchema, select, reorder, move }
 *
 * 所有变更前 history.push(当前态)，保证 AI/人工改动均可撤销。
 * AI 生成（applySchema/applyPatch）用 source='ai'，供 UI 区分。
 */
import { type Ref } from 'vue'
import {
  getComponentMeta,
  isContainerType,
  reorderRootChildren,
} from 'luban-low-code'
import { findNode, findParent, removeNode, moveChild } from '@/views/page/components/schemaTree'
import type { PageSchema, NodeSchema } from '@/types/schema'
import type { UseHistoryReturn, ChangeSource } from '@/composables/useHistory'

function genId(prefix = 'n'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* noop */
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface UsePageEditorApiReturn {
  selectedId: Ref<string | null>
  addNode: (type: string, parentId?: string) => NodeSchema | null
  updateProp: (nodeId: string, key: string, value: unknown) => void
  updateEvent: (nodeId: string, eventName: string, expr: string) => void
  deleteNode: (nodeId: string) => boolean
  duplicateNode: (nodeId: string) => NodeSchema | null
  /** 增量 patch：用 patch 指定字段覆盖单节点 props */
  applyPatch: (patch: NodePatch) => void
  /** 整页替换：AI 生成完整 schema 落地 */
  applySchema: (next: PageSchema, label?: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
  move: (parentId: string | null, fromIdx: number, toIdx: number) => void
  select: (id: string | null) => void
  /** 撤销/重做（透传 history，PageEditor 统一调用入口） */
  undo: () => void
  redo: () => void
}

export interface NodePatch {
  /** 目标节点 id */
  nodeId: string
  /** 要覆盖的 props（浅合并到 node.props） */
  props?: Record<string, unknown>
  /** 要覆盖的事件绑定 */
  events?: Record<string, string>
}

export function usePageEditorApi(
  schema: Ref<PageSchema | null>,
  history: UseHistoryReturn,
  selectedId: Ref<string | null>
): UsePageEditorApiReturn {
  function snapshot(source: ChangeSource = 'manual', label?: string) {
    if (schema.value) history.push(schema.value, source, label)
  }

  function addNode(type: string, parentId?: string): NodeSchema | null {
    if (!schema.value?.root) return null
    const meta = getComponentMeta(type)
    const defaultProps: Record<string, unknown> = meta?.defaultProps ? { ...meta.defaultProps } : {}
    const node: NodeSchema = { id: genId(type), type, props: defaultProps }
    if (isContainerType(type)) node.children = []

    snapshot('manual', `添加 ${meta?.label ?? type}`)

    let host: NodeSchema | null = schema.value.root
    if (parentId) {
      const found = findNode(schema.value.root, parentId)
      if (found && isContainerType(found.type)) host = found
    }
    if (!host.children) host.children = []
    host.children.push(node)
    selectedId.value = node.id
    return node
  }

  function updateProp(nodeId: string, key: string, value: unknown): void {
    if (!schema.value?.root) return
    const node = findNode(schema.value.root, nodeId)
    if (!node) return
    snapshot('manual', `修改 ${key}`)
    if (!node.props) node.props = {}
    node.props[key] = value
  }

  function updateEvent(nodeId: string, eventName: string, expr: string): void {
    if (!schema.value?.root) return
    const node = findNode(schema.value.root, nodeId)
    if (!node) return
    snapshot('manual', `修改事件 ${eventName}`)
    if (!node.eventBindings) node.eventBindings = {}
    node.eventBindings[eventName] = expr
  }

  function deleteNode(nodeId: string): boolean {
    if (!schema.value?.root) return false
    if (schema.value.root.id === nodeId) return false
    snapshot('manual', '删除节点')
    const ok = removeNode(schema.value.root, nodeId)
    if (ok && selectedId.value === nodeId) selectedId.value = null
    return ok
  }

  function duplicateNode(nodeId: string): NodeSchema | null {
    if (!schema.value?.root) return null
    const node = findNode(schema.value.root, nodeId)
    const parent = findParent(schema.value.root, nodeId)
    if (!node || !parent || !parent.children) return null
    snapshot('manual', '复制节点')
    const cloneNode: NodeSchema = JSON.parse(JSON.stringify(node))
    cloneNode.id = genId(node.type)
    const idx = parent.children.findIndex((c) => c.id === nodeId)
    parent.children.splice(idx + 1, 0, cloneNode)
    selectedId.value = cloneNode.id
    return cloneNode
  }

  function applyPatch(patch: NodePatch): void {
    if (!schema.value?.root) return
    const node = findNode(schema.value.root, patch.nodeId)
    if (!node) return
    snapshot('ai', 'AI 修改属性')
    if (patch.props) {
      node.props = { ...(node.props ?? {}), ...patch.props }
    }
    if (patch.events) {
      node.eventBindings = { ...(node.eventBindings ?? {}), ...patch.events }
    }
  }

  function applySchema(next: PageSchema, label = 'AI 生成页面'): void {
    snapshot('ai', label)
    schema.value = next
  }

  function reorder(fromIdx: number, toIdx: number): void {
    if (!schema.value) return
    snapshot('manual', '重排节点')
    reorderRootChildren(schema.value, fromIdx, toIdx)
  }

  function move(parentId: string | null, fromIdx: number, toIdx: number): void {
    if (!schema.value?.root) return
    const parent = parentId ? findNode(schema.value.root, parentId) : null
    if (parentId && !parent) return
    snapshot('manual', '移动节点')
    moveChild(parent, schema.value.root, fromIdx, toIdx)
  }

  function select(id: string | null): void {
    selectedId.value = id
  }

  function undo(): void {
    if (!schema.value) return
    const prev = history.undo(schema.value)
    if (prev) schema.value = prev
  }

  function redo(): void {
    if (!schema.value) return
    const next = history.redo(schema.value)
    if (next) schema.value = next
  }

  return {
    selectedId,
    addNode,
    updateProp,
    updateEvent,
    deleteNode,
    duplicateNode,
    applyPatch,
    applySchema,
    reorder,
    move,
    select,
    undo,
    redo,
  }
}
