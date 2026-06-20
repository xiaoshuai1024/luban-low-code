<script setup lang="ts">
/**
 * ComponentTree.vue — 页面组件树（大纲）面板。
 *
 * 用 ElTree 渲染 schema.root 下的节点层级（递归 children），
 * 支持选中、删除、上移、下移。节点 label 默认取 type；
 * 若调用方传入 getLabel（通常包 getComponentMeta(type)?.label），
 * 则显示物料中文名。
 *
 * 依赖：
 * - Element Plus（ElTree / ElButton / ElEmpty）。main.ts 已 app.use(ElementPlus)。
 * - NodeSchema / PageSchema 来自 engine 本地 @/types/schema（与 PageEditor.vue 一致）。
 *   与 luban-low-code 导出的同名类型结构兼容。
 *
 * 不静态 import getComponentMeta：避免对 luban-low-code 运行时模块的
 * 静态依赖破坏 vue-tsc build（engine node_modules 可能不含 luban-low-code）。
 * 由调用方通过 getLabel prop 注入。
 */
import { computed } from 'vue'
import { ElTree, ElButton, ElEmpty } from 'element-plus'
import type { PageSchema, NodeSchema } from '@/types/schema'
import { isFeatureEnabled } from '@/config/features'

interface Props {
  schema: PageSchema | null
  selectedId: string | null
  readonly?: boolean
  /** 可选：返回节点显示名。默认返回 node.type。 */
  getLabel?: (node: NodeSchema) => string
}

const props = withDefaults(defineProps<Props>(), {
  schema: null,
  selectedId: null,
  readonly: false,
  getLabel: (node: NodeSchema) => node.type,
})

const emit = defineEmits<{
  (e: 'select', nodeId: string | null): void
  (e: 'delete', nodeId: string): void
  (e: 'move', parentId: string | null, fromIdx: number, toIdx: number): void
  /** Y3：切换节点锁定态 */
  (e: 'lock', nodeId: string): void
  /** Y3：切换节点隐藏态 */
  (e: 'hide', nodeId: string): void
}>()

/** Y3：锁定/隐藏按钮开关（FeatureGate 控制） */
const lockHideEnabled = isFeatureEnabled('treeLockHide')

/**
 * ElTree 需要一个根数组。schema.root 自身（LubanContainer）通常不展示
 * 为可操作节点（删除/移动 root 无意义），故只渲染 root.children。
 * 若 root 无 children，显示空态。
 */
const treeData = computed<NodeSchema[]>(() => {
  if (!props.schema || !props.schema.root) return []
  return props.schema.root.children ?? []
})

/** ElTree props 映射：children 字段 + label 由 getLabel 计算。 */
const treeProps = {
  children: 'children',
  label: 'label',
}

function resolveLabel(data: NodeSchema): string {
  try {
    return props.getLabel(data) || data.type
  } catch {
    return data.type
  }
}

function handleNodeClick(data: NodeSchema): void {
  emit('select', data.id)
}

function handleSelectRoot(): void {
  // 点击"页面根"条目 → 选中 root（parent=null 语义）
  if (props.schema?.root) {
    emit('select', props.schema.root.id)
  }
}

function isRootSelected(): boolean {
  return (
    !!props.schema?.root &&
    props.selectedId === props.schema.root.id
  )
}

function currentKeys(): string[] {
  return props.selectedId ? [props.selectedId] : []
}

function canMoveUp(node: NodeSchema): boolean {
  const info = locate(node)
  if (!info) return false
  return info.index > 0
}

function canMoveDown(node: NodeSchema): boolean {
  const info = locate(node)
  if (!info) return false
  return info.index < info.siblings.length - 1
}

function locate(node: NodeSchema): { parent: NodeSchema | null; index: number; siblings: NodeSchema[] } | null {
  if (!props.schema?.root) return null
  const root = props.schema.root

  // root 级查找
  const rootChildren = root.children ?? []
  const rootIdx = rootChildren.findIndex((c) => c.id === node.id)
  if (rootIdx >= 0) {
    return { parent: null, index: rootIdx, siblings: rootChildren }
  }

  // 递归在容器 children 中查找
  const found = findLocInSubtree(root, node.id)
  return found
}

function findLocInSubtree(
  current: NodeSchema,
  id: string,
): { parent: NodeSchema | null; index: number; siblings: NodeSchema[] } | null {
  const children = current.children ?? []
  const idx = children.findIndex((c) => c.id === id)
  if (idx >= 0) {
    return { parent: current, index: idx, siblings: children }
  }
  for (const child of children) {
    if (child.children && child.children.length > 0) {
      const deeper = findLocInSubtree(child, id)
      if (deeper) return deeper
    }
  }
  return null
}

function handleMoveUp(node: NodeSchema): void {
  const info = locate(node)
  if (!info || info.index <= 0) return
  emit('move', info.parent?.id ?? null, info.index, info.index - 1)
}

function handleMoveDown(node: NodeSchema): void {
  const info = locate(node)
  if (!info) return
  if (info.index >= info.siblings.length - 1) return
  emit('move', info.parent?.id ?? null, info.index, info.index + 1)
}

function handleDelete(node: NodeSchema): void {
  // Y3：锁定节点禁止删除
  if (node.locked) return
  emit('delete', node.id)
}

/** Y3：切换锁定态 */
function handleToggleLock(node: NodeSchema): void {
  emit('lock', node.id)
}

/** Y3：切换隐藏态 */
function handleToggleHide(node: NodeSchema): void {
  emit('hide', node.id)
}
</script>

<template>
  <div class="component-tree">
    <div class="component-tree__header">
      <span class="component-tree__title">组件树</span>
    </div>

    <ElEmpty
      v-if="treeData.length === 0"
      description="暂无组件，从画布拖入组件"
      :image-size="80"
    />

    <div v-else class="component-tree__body">
      <!-- 页面根（root，不可删除/移动） -->
      <div
        class="component-tree__root"
        :class="{ 'is-selected': isRootSelected() }"
        @click="handleSelectRoot"
      >
        <span class="component-tree__root-label">页面根</span>
        <span v-if="schema?.root" class="component-tree__root-type">{{ schema.root.type }}</span>
      </div>

      <ElTree
        :data="treeData"
        :props="treeProps"
        node-key="id"
        :expand-on-click-node="false"
        :highlight-current="true"
        :current-node-key="selectedId ?? undefined"
        :default-expanded-keys="currentKeys()"
        @node-click="handleNodeClick"
      >
        <template #default="{ data }">
          <div
            class="component-tree__node"
            :class="{ 'is-selected': data.id === selectedId }"
          >
            <span class="component-tree__node-label">{{ resolveLabel(data) }}</span>
            <!-- Y3：锁定/隐藏态徽标 -->
            <span v-if="lockHideEnabled && data.locked" class="component-tree__badge" title="已锁定">🔒</span>
            <span v-if="lockHideEnabled && data.hidden" class="component-tree__badge" title="已隐藏">🚫</span>
            <span v-if="!readonly" class="component-tree__node-actions">
              <ElButton
                v-if="lockHideEnabled"
                link
                size="small"
                :title="data.locked ? '解锁 (L)' : '锁定 (L)'"
                @click.stop="handleToggleLock(data)"
              >
                {{ data.locked ? '🔓' : '🔒' }}
              </ElButton>
              <ElButton
                v-if="lockHideEnabled"
                link
                size="small"
                :title="data.hidden ? '显示 (H)' : '隐藏 (H)'"
                @click.stop="handleToggleHide(data)"
              >
                {{ data.hidden ? '👁' : '👁‍🗨' }}
              </ElButton>
              <ElButton
                link
                size="small"
                :disabled="!canMoveUp(data)"
                @click.stop="handleMoveUp(data)"
              >
                上移
              </ElButton>
              <ElButton
                link
                size="small"
                :disabled="!canMoveDown(data)"
                @click.stop="handleMoveDown(data)"
              >
                下移
              </ElButton>
              <ElButton
                link
                type="danger"
                size="small"
                :disabled="data.locked === true"
                :title="data.locked ? '锁定节点不可删除' : '删除'"
                @click.stop="handleDelete(data)"
              >
                删除
              </ElButton>
            </span>
          </div>
        </template>
      </ElTree>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.component-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;

  &__header {
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid #ebeef5;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  &__body {
    flex: 1;
    overflow: auto;
  }

  &__root {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;

    &:hover {
      background: #f5f7fa;
    }

    &.is-selected {
      background: #ecf5ff;
      color: #409eff;
    }
  }

  &__root-label {
    font-weight: 600;
  }

  &__root-type {
    font-size: 12px;
    color: #909399;
  }

  &__node {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    padding-right: 8px;
    font-size: 13px;

    &.is-selected {
      color: #409eff;
      font-weight: 600;
    }
  }

  &__node-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__badge {
    font-size: 12px;
    flex-shrink: 0;
    margin-left: 2px;
  }

  &__node-actions {
    display: none;
    gap: 4px;
    flex-shrink: 0;
  }

  &__node:hover &__node-actions {
    display: inline-flex;
  }
}
</style>
