<script setup lang="ts">
/**
 * ComponentPreview — 文档站组件实时预览容器。
 *
 * 用法（在 Markdown 中）：
 * ```md
 * <ComponentPreview title="按钮变体">
 *   <LubanButton color="primary">主要按钮</LubanButton>
 *   <LubanButton color="secondary">次要按钮</LubanButton>
 * </ComponentPreview>
 * ```
 */
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="component-preview">
    <div v-if="title" class="component-preview__header">
      <span class="component-preview__title">{{ title }}</span>
      <span v-if="description" class="component-preview__desc">{{ description }}</span>
    </div>
    <div class="component-preview__canvas">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.component-preview {
  margin: 24px 0;
  border: 1px solid var(--vp-c-divider, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
}
.component-preview__header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--vp-c-divider, #e2e8f0);
  background: var(--vp-c-bg-soft, #f8fafc);
  display: flex;
  align-items: center;
  gap: 12px;
}
.component-preview__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1, #1e293b);
}
.component-preview__desc {
  font-size: 13px;
  color: var(--vp-c-text-2, #64748b);
}
.component-preview__canvas {
  padding: 32px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  background: var(--vp-c-bg, #ffffff);
}
</style>
