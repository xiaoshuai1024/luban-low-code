<script setup lang="ts">
/**
 * TemplatePicker.vue — V2-T3 模板选择器（新建页时弹层）。
 *
 * ElDialog + 缩略图网格；按 category 分组展示；点击模板卡片 emit('select', template)。
 * 含「空白页」选项（从零开始）。
 *
 * 用法：
 *   <TemplatePicker v-model="visible" @select="onPick" />
 *   onPick(tpl) → 注入 schema 到 PageEditor
 *
 * FeatureGate：VITE_FEATURE_TEMPLATES 关闭时 PageList 不触发本弹层。
 */
import {
  ElDialog,
  ElEmpty,
} from 'element-plus'
import { computed } from 'vue'
import { TEMPLATES, groupTemplatesByCategory, type PageTemplate } from '@/config/templates'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', template: PageTemplate): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const grouped = computed(() => groupTemplatesByCategory())

function pick(tpl: PageTemplate): void {
  emit('select', tpl)
  emit('update:modelValue', false)
}

function close(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="选择模板"
    width="80%"
    :close-on-click-modal="true"
    @close="close"
  >
    <div class="template-picker">
      <p class="template-picker__hint">选择一个模板快速开始，或从空白页自由搭建。共 {{ TEMPLATES.length }} 个模板。</p>
      <div v-for="group in grouped" :key="group.category" class="template-picker__group">
        <div class="template-picker__group-title">{{ group.category }}</div>
        <div class="template-picker__grid">
          <button
            v-for="tpl in group.templates"
            :key="tpl.id"
            class="template-picker__card"
            @click="pick(tpl)"
          >
            <div class="template-picker__thumb">{{ tpl.thumbnail }}</div>
            <div class="template-picker__name">{{ tpl.name }}</div>
            <div class="template-picker__desc">{{ tpl.description }}</div>
          </button>
        </div>
      </div>
      <ElEmpty v-if="TEMPLATES.length === 0" description="暂无模板" />
    </div>
  </ElDialog>
</template>

<style lang="scss" scoped>
.template-picker {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;

  &__hint {
    font-size: 13px;
    color: #909399;
    margin: 0 0 16px;
  }

  &__group {
    margin-bottom: 24px;
  }

  &__group-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #ebeef5;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  &__card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 16px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    font-family: inherit;

    &:hover {
      border-color: #409eff;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
      transform: translateY(-2px);
    }
  }

  &__thumb {
    font-size: 36px;
    line-height: 1;
    margin-bottom: 4px;
  }

  &__name {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  &__desc {
    font-size: 12px;
    color: #909399;
    line-height: 1.4;
  }
}
</style>
