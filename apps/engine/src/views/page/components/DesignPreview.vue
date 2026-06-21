<script setup lang="ts">
/**
 * DesignPreview.vue — 原图↔生成 schema 对照预览（plan P2-T4 / plan §4.3）。
 *
 * 左侧原图缩略，右侧 schema 树形预览（复用 SchemaTreePreview）。
 * 不确定组件在 schema 中标「待确认」（黄色），与原图对照便于人工核对。
 */
import type { PageSchema } from '@/types/schema'
import SchemaTreePreview from './SchemaTreePreview.vue'

interface Props {
  imageUrl: string | null
  schema: PageSchema | null
  /** 理解进度步骤（understanding 阶段展示识别到的布局/组件）。 */
  steps?: Array<{ type: string; message?: string; result?: string }>
}
withDefaults(defineProps<Props>(), {
  imageUrl: null,
  schema: null,
  steps: () => [],
})
</script>

<template>
  <div class="design-preview">
    <!-- 理解进度（识别到的布局/组件/文字） -->
    <div v-if="steps.length > 0" class="design-preview__steps">
      <div v-for="(step, idx) in steps" :key="idx" class="design-preview__step">
        <span v-if="step.type === 'progress'">✅ {{ step.message }}</span>
        <span v-else-if="step.type === 'tool'">🛠 {{ step.result || step.message }}</span>
        <span v-else-if="step.type === 'warning'">⚠️ {{ step.message }}</span>
      </div>
    </div>

    <!-- 原图 ↔ schema 对照 -->
    <div class="design-preview__compare">
      <div class="design-preview__side">
        <div class="design-preview__label">原图</div>
        <img v-if="imageUrl" :src="imageUrl" alt="设计稿原图" class="design-preview__img" />
        <div v-else class="design-preview__noimg">（无图）</div>
      </div>
      <div class="design-preview__side">
        <div class="design-preview__label">生成 schema</div>
        <SchemaTreePreview :schema="schema" class="design-preview__schema" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.design-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__steps {
    background: #fafafa;
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__step {
    font-size: 13px;
    color: #606266;
  }

  &__compare {
    display: flex;
    gap: 12px;
  }

  &__side {
    flex: 1;
    min-width: 0;
  }

  &__label {
    font-size: 12px;
    font-weight: 600;
    color: #909399;
    margin-bottom: 6px;
    text-transform: uppercase;
  }

  &__img {
    max-width: 100%;
    max-height: 220px;
    object-fit: contain;
    border: 1px solid #ebeef5;
    border-radius: 4px;
  }

  &__noimg {
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c0c4cc;
    border: 1px dashed #ebeef5;
    border-radius: 4px;
  }

  &__schema {
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 8px;
  }
}
</style>
