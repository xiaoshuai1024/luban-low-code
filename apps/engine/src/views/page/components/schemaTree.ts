/**
 * schemaTree.ts — 页面 schema 树的纯逻辑操作工具。
 *
 * 提供 findNode / findParent / removeNode / moveChild 四个无副作用查询
 * 与原地（in-place）变更函数，供 ComponentTree / PageEditor 的组件树
 * 选中、删除、上移/下移/拖拽排序使用。
 *
 * 类型说明：
 * - NodeSchema 来自 `@/types/schema`（re-export luban-low-code，single source），
 *   含第1波新增 visible/loop/events/datasource/locked/hidden 字段。
 * - eventBindings（旧）已统一为 events。
 *
 * 不变量：
 * - root 节点本身不可被删除/移动（findParent(root.id) === null）。
 * - 所有写操作（removeNode / moveChild）就地修改传入的树并返回是否成功。
 */

import type { NodeSchema } from '@/types/schema'

/**
 * 在 schema 树中按 id 查找节点。
 * @returns 命中则返回节点引用，否则 null。root 自身也可被命中。
 */
export function findNode(root: NodeSchema, id: string): NodeSchema | null {
  if (!root) return null
  if (root.id === id) return root
  const children = root.children
  if (!children || children.length === 0) return null
  for (const child of children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return null
}

/**
 * 查找指定 id 节点的父节点。
 * @returns 父节点引用；若 id 命中的就是 root，或 id 不存在，返回 null。
 */
export function findParent(root: NodeSchema, id: string): NodeSchema | null {
  if (!root || root.id === id) return null
  return findParentInner(root, id)
}

function findParentInner(current: NodeSchema, id: string): NodeSchema | null {
  const children = current.children
  if (!children || children.length === 0) return null
  for (const child of children) {
    if (child.id === id) return current
    const deeper = findParentInner(child, id)
    if (deeper) return deeper
  }
  return null
}

/**
 * 从树中删除指定 id 的节点（root 自身不可删除）。
 * @returns true 表示找到并删除；false 表示未找到或试图删除 root。
 */
export function removeNode(root: NodeSchema, id: string): boolean {
  if (!root) return false
  const parent = findParent(root, id)
  if (!parent || !parent.children) return false
  const before = parent.children.length
  parent.children = parent.children.filter((c) => c.id !== id)
  return parent.children.length < before
}

/**
 * 在同一父节点下移动子节点（用于上移/下移/拖拽排序）。
 *
 * @param parent  目标父节点；传 null 表示 root 级（即 root.children）。
 * @param root    整棵树的根（用于在 parent===null 时定位 root.children）。
 * @param fromIdx 源索引。
 * @param toIdx   目标索引。
 * @returns true 表示移动成功；false 表示参数越界或父节点无 children。
 *
 * 算法与 luban-low-code 的 reorderRootChildren 一致（splice 移除后插入），
 * 这里自行实现以避免对 luban-low-code 的静态模块依赖（保持 vue-tsc build 稳定）。
 */
export function moveChild(
  parent: NodeSchema | null,
  root: NodeSchema,
  fromIdx: number,
  toIdx: number,
): boolean {
  if (!root) return false
  const host = parent ?? root
  const children = host.children
  if (!children || children.length === 0) return false
  if (
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= children.length ||
    toIdx >= children.length ||
    fromIdx === toIdx
  ) {
    return false
  }
  const [removed] = children.splice(fromIdx, 1)
  children.splice(toIdx, 0, removed)
  return true
}

/**
 * 计算节点在父级 children 中的索引；用于上移/下移按钮的 from/to 计算。
 * @returns [parent, index]；parent 为 null 表示 root 级；未找到返回 null。
 */
export function locateInParent(
  root: NodeSchema,
  id: string,
): { parent: NodeSchema | null; index: number } | null {
  if (!root) return null
  if (root.id === id) return { parent: null, index: -1 } // root 自身无父级
  const parent = findParent(root, id)
  if (!parent || !parent.children) return null
  const index = parent.children.findIndex((c) => c.id === id)
  if (index < 0) return null
  // parent===root 表示该节点是 root 级直接子节点；按 moveChild 约定（parent:null ⟺ root 级）归一为 null
  return { parent: parent === root ? null : parent, index }
}
