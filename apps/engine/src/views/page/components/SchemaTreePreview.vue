<script setup lang="ts">
/**
 * SchemaTreePreview.vue — PageSchema 树形结构化预览（plan P1-T8 禁令5：禁 JSON 代页面）。
 *
 * 把 AI 生成的 schema 以可读树形渲染（缩进 + 物料类型 + 关键 props 摘要），
 * 供 AI 面板 awaiting_confirm 态展示。非纯 JSON dump，有结构化层级。
 */
import { computed } from 'vue'
import type { PageSchema, NodeSchema } from '@/types/schema'
import { getComponentMeta } from 'luban-low-code'

interface Props {
  schema: PageSchema | null
}
const props = defineProps<Props>()

interface PreviewNode {
  id: string
  type: string
  label: string
  propSummary: string
  children: PreviewNode[]
  uncertain?: boolean
}

function summarizeProps(node: NodeSchema): string {
  if (!node.props) return ''
  const entries = Object.entries(node.props).slice(0, 3)
  return entries.map(([k, v]) => {
    const vs = typeof v === 'string' ? v : JSON.stringify(v)
    return `${k}=${vs.length > 20 ? vs.slice(0, 20) + '…' : vs}`
  }).join(' ')
}

function toPreview(node: NodeSchema): PreviewNode {
  const meta = getComponentMeta(node.type)
  return {
    id: node.id,
    type: node.type,
    label: meta?.label ?? node.type,
    propSummary: summarizeProps(node),
    children: (node.children ?? []).map(toPreview),
  }
}

const previewRoot = computed<PreviewNode | null>(() => {
  if (!props.schema?.root) return null
  return toPreview(props.schema.root)
})
</script>

<template>
  <div v-if="previewRoot" class="schema-preview">
    <div class="schema-preview__node schema-preview__node--root">
      <span class="schema-preview__label">{{ previewRoot.label }}</span>
      <span class="schema-preview__type">({{ previewRoot.type }})</span>
    </div>
    <template v-for="child in previewRoot.children" :key="child.id">
      <div
        class="schema-preview__node"
        :class="{ 'schema-preview__node--uncertain': child.uncertain }"
        :style="{ marginLeft: '12px' }"
      >
        <span class="schema-preview__label">{{ child.label }}</span>
        <span class="schema-preview__type">({{ child.type }})</span>
        <span v-if="child.propSummary" class="schema-preview__props">{{ child.propSummary }}</span>
        <span v-if="child.uncertain" class="schema-preview__uncertain">待确认</span>
      </div>
      <div
        v-for="gc in child.children"
        :key="gc.id"
        class="schema-preview__node"
        :class="{ 'schema-preview__node--uncertain': gc.uncertain }"
        :style="{ marginLeft: '24px' }"
      >
        <span class="schema-preview__label">{{ gc.label }}</span>
        <span class="schema-preview__type">({{ gc.type }})</span>
        <span v-if="gc.propSummary" class="schema-preview__props">{{ gc.propSummary }}</span>
      </div>
    </template>
  </div>
  <div v-else class="schema-preview__empty">（空 schema）</div>
</template>

<style lang="scss" scoped>
.schema-preview {
  font-size: 13px;
  line-height: 1.8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #303133;

  &__node {
    padding: 2px 4px;
    border-radius: 3px;

    &--root {
      font-weight: 600;
    }

    &--uncertain {
      background: #fdf6ec;
    }
  }

  &__label {
    color: #303133;
  }

  &__type {
    color: #909399;
    font-size: 12px;
  }

  &__props {
    color: #67c23a;
    margin-left: 8px;
    font-size: 12px;
  }

  &__uncertain {
    color: #e6a23c;
    margin-left: 8px;
    font-size: 11px;
    border: 1px solid #e6a23c;
    border-radius: 3px;
    padding: 0 4px;
  }

  &__empty {
    color: #909399;
    font-style: italic;
  }
}
</style>
