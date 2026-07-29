/**
 * usePageEditorApi — 画布操作统一 API 收口（plan P1-T8）。
 *
 * 收口 PageEditor.vue 原本的 10 个 on* 私有函数（onSelect/onAddNode/onReorder/
 * onMoveNode/onUpdateProp/onUpdateEvent/onUpdateDatasource/onDeleteNode/onDuplicateNode/
 * onMove），并新增 AI 集成所需的 replaceSchema（整树替换，AI 生成页落画布）与
 * 只读查询 findNodeById/getSelectedNode（AI 抽屉消费当前 schema）。
 *
 * 设计目标：
 * 1. 单一写入入口 —— 所有 schema mutation 经此 hook，撤销栈语义统一
 *    （snapshot→mutate→成功才 pushSnapshot，no-op 不入栈，与 PageEditor 既有实现一致）。
 * 2. schema SSOT 保持 PageEditor 局部 ref（history 绑定该 ref 做 undo/redo）；
 *    本 hook 接收该 ref 的写入权，PageEditor 自身只读用于 v-model 透传。
 * 3. AI 面板（AiAssistantPanel）与用户操作（LubanDesigner/PropertyPanel/ComponentTree）
 *    共享同一份 schema + 同一撤销栈 —— AI 改动可被 Ctrl+Z 撤销（plan §3 验收口径）。
 *
 * 不变量：
 * - root 节点不可删除/移动（schemaTree.removeNode 返回 false）。
 * - 节点 id 用 crypto.randomUUID 兜底（沿用 PageEditor 原 genId）。
 * - 增/删/复制后更新 selectedId（选中新增节点；删除选中节点时清空）。
 */
import type { Ref } from 'vue'
import type { PageSchema, NodeSchema } from '@/types/schema'
import {
  findNode,
  findParent,
  removeNode,
  moveChild,
  moveNodeAcross,
} from '@/views/page/components/schemaTree'
import { getComponentMeta, isContainerType, reorderRootChildren } from 'luban-low-code'

/** useHistory 的最小依赖切片（避免耦合完整类型，便于测试 mock）。
 *  绑死到 PageSchema：usePageEditorApi 仅处理 PageSchema 的快照。 */
export interface PageEditorHistoryLike {
  snapshot(): PageSchema | null
  pushSnapshot(prev: PageSchema | null): void
}

export interface PageEditorApiDeps {
  schema: Ref<PageSchema | null>
  history: PageEditorHistoryLike
  selectedId: Ref<string | null>
  /** id 生成器，默认 crypto.randomUUID 兜底（可注入便于测试固定 id）。 */
  genId?: (prefix?: string) => string
}

export interface PageEditorApi {
  /** 选中节点（null 清空），不入撤销栈。 */
  select(id: string | null): void
  /**
   * 新增节点。parentId 未传或容器不存在时追加到 root.children；否则追加到容器 children。
   * props 由 meta.defaultProps 派生；容器类型给空 children 数组。
   * @returns 新节点 id（失败返回 null）。
   */
  addNode(type: string, parentId?: string): string | null
  /** root 级 Sortable 重排。 */
  reorder(fromIdx: number, toIdx: number): void
  /** 跨容器拖拽：nodeId 移到 toParentId（null=root 级）的 toIdx。 */
  moveNode(nodeId: string, toParentId: string | null, toIdx: number): void
  /** 属性面板回写 props。 */
  updateProp(nodeId: string, key: string, value: unknown): void
  /** 事件分区回写 node.events[eventName]。 */
  updateEvent(nodeId: string, eventName: string, actionExpr: string): void
  /** 数据源分区回写 node.datasource。 */
  updateDatasource(nodeId: string, ds: { id: string; varName: string } | null): void
  /** 删除节点（root 不可删）；删选中节点时清空 selectedId。 */
  deleteNode(nodeId: string): void
  /** 复制节点（深克隆 children，新 id），选中复制节点。@returns 新 clone id 或 null。 */
  duplicateNode(nodeId: string): string | null
  /** 组件树上移/下移：parentId=null 表示 root 级。 */
  move(parentId: string | null, fromIdx: number, toIdx: number): void
  /**
   * AI 整树替换（plan P1-T8 AI 面板落画布）。整体替换 root，走撤销栈可被 Ctrl+Z 撤销。
   * 用于「整页生成/覆盖」场景；单属性编辑走 updateProp。
   */
  replaceSchema(newRoot: NodeSchema): void
  /** 按 id 查节点（只读，AI 抽屉消费）。 */
  findNodeById(id: string): NodeSchema | null
  /** 当前选中节点（只读派生）。 */
  getSelectedNode(): NodeSchema | null
}

/** crypto.randomUUID 兜底实现（与 PageEditor 原 genId 完全一致）。 */
export function defaultGenId(prefix = 'n'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* noop */
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function usePageEditorApi(deps: PageEditorApiDeps): PageEditorApi {
  const { schema, history, selectedId } = deps
  const genId = deps.genId ?? defaultGenId

  function select(id: string | null): void {
    selectedId.value = id
  }

  function addNode(type: string, parentId?: string): string | null {
    if (!schema.value?.root) return null
    const prev = history.snapshot()
    const meta = getComponentMeta(type)
    const defaultProps: Record<string, unknown> = meta?.defaultProps ? { ...meta.defaultProps } : {}
    const node: NodeSchema = { id: genId(type), type, props: defaultProps }
    if (isContainerType(type)) node.children = []

    let host: NodeSchema | null = schema.value.root
    if (parentId) {
      const found = findNode(schema.value.root, parentId)
      if (found && isContainerType(found.type)) host = found
    }
    if (!host.children) host.children = []
    host.children.push(node)
    selectedId.value = node.id
    history.pushSnapshot(prev)
    return node.id
  }

  function reorder(fromIdx: number, toIdx: number): void {
    if (!schema.value) return
    const prev = history.snapshot()
    reorderRootChildren(schema.value, fromIdx, toIdx)
    history.pushSnapshot(prev)
  }

  function moveNode(nodeId: string, toParentId: string | null, toIdx: number): void {
    if (!schema.value?.root) return
    const prev = history.snapshot()
    const ok = moveNodeAcross(schema.value.root, nodeId, toParentId, toIdx)
    if (ok) history.pushSnapshot(prev)
  }

  function updateProp(nodeId: string, key: string, value: unknown): void {
    if (!schema.value?.root) return
    const node = findNode(schema.value.root, nodeId)
    if (!node) return
    const prev = history.snapshot()
    if (!node.props) node.props = {}
    node.props[key] = value
    history.pushSnapshot(prev)
  }

  function updateEvent(nodeId: string, eventName: string, actionExpr: string): void {
    if (!schema.value?.root) return
    const node = findNode(schema.value.root, nodeId)
    if (!node) return
    const prev = history.snapshot()
    if (!node.events) node.events = {}
    node.events[eventName] = actionExpr
    history.pushSnapshot(prev)
  }

  function updateDatasource(nodeId: string, ds: { id: string; varName: string } | null): void {
    if (!schema.value?.root) return
    const node = findNode(schema.value.root, nodeId)
    if (!node) return
    const prev = history.snapshot()
    node.datasource = ds ?? undefined
    history.pushSnapshot(prev)
  }

  function deleteNode(nodeId: string): void {
    if (!schema.value?.root) return
    if (schema.value.root.id === nodeId) return
    const prev = history.snapshot()
    const ok = removeNode(schema.value.root, nodeId)
    if (ok) {
      history.pushSnapshot(prev)
      if (selectedId.value === nodeId) selectedId.value = null
    }
  }

  function duplicateNode(nodeId: string): string | null {
    if (!schema.value?.root) return null
    const node = findNode(schema.value.root, nodeId)
    const parent = findParent(schema.value.root, nodeId)
    if (!node || !parent || !parent.children) return null
    const prev = history.snapshot()
    const cloneNode: NodeSchema = JSON.parse(JSON.stringify(node))
    cloneNode.id = genId(node.type)
    const idx = parent.children.findIndex((c) => c.id === nodeId)
    parent.children.splice(idx + 1, 0, cloneNode)
    selectedId.value = cloneNode.id
    history.pushSnapshot(prev)
    return cloneNode.id
  }

  function move(parentId: string | null, fromIdx: number, toIdx: number): void {
    if (!schema.value?.root) return
    const parent = parentId ? findNode(schema.value.root, parentId) : null
    if (parentId && !parent) return
    const prev = history.snapshot()
    const ok = moveChild(parent, schema.value.root, fromIdx, toIdx)
    if (ok) history.pushSnapshot(prev)
  }

  function replaceSchema(newRoot: NodeSchema): void {
    if (!schema.value) return
    const prev = history.snapshot()
    schema.value = { ...schema.value, root: newRoot }
    history.pushSnapshot(prev)
  }

  function findNodeById(id: string): NodeSchema | null {
    if (!schema.value?.root) return null
    return findNode(schema.value.root, id)
  }

  function getSelectedNode(): NodeSchema | null {
    if (!schema.value?.root || !selectedId.value) return null
    return findNode(schema.value.root, selectedId.value)
  }

  return {
    select,
    addNode,
    reorder,
    moveNode,
    updateProp,
    updateEvent,
    updateDatasource,
    deleteNode,
    duplicateNode,
    move,
    replaceSchema,
    findNodeById,
    getSelectedNode,
  }
}
