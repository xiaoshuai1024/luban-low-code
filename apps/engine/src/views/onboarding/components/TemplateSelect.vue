<script setup lang="ts">
/**
 * TemplateSelect.vue — 开通向导 Step3 模板网格（signup-billing-onboarding §4.2.2/§9.5）。
 *
 * props {modelValue}（模板 id）；复用 config/templates.ts 的 TEMPLATES/groupTemplatesByCategory
 * 与 TemplatePicker 卡片样式（缩略图+名称+描述，分组标题），点选主色描边。
 */
import { computed } from 'vue'
import { ElEmpty } from 'element-plus'
import { groupTemplatesByCategory, TEMPLATES } from '@/config/templates'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const grouped = computed(() => groupTemplatesByCategory())

function pick(id: string): void {
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="template-select">
    <p class="template-select__hint">选择一个模板创建首页，进入设计器后可自由修改。共 {{ TEMPLATES.length }} 个模板。</p>
    <div v-for="group in grouped" :key="group.category" class="template-select__group">
      <div class="template-select__group-title">{{ group.category }}</div>
      <div class="template-select__grid">
        <button
          v-for="tpl in group.templates"
          :key="tpl.id"
          type="button"
          class="template-select__card"
          :class="{ 'is-selected': tpl.id === modelValue }"
          @click="pick(tpl.id)"
        >
          <div class="template-select__thumb">{{ tpl.thumbnail }}</div>
          <div class="template-select__name">{{ tpl.name }}</div>
          <div class="template-select__desc">{{ tpl.description }}</div>
        </button>
      </div>
    </div>
    <ElEmpty v-if="TEMPLATES.length === 0" description="暂无模板" />
  </div>
</template>

<style lang="scss" scoped>
.template-select__hint {
  font-size: 13px;
  color: #909399;
  margin: 0 0 16px;
}

.template-select__group {
  margin-bottom: 20px;
}

.template-select__group-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #ebeef5;
}

.template-select__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.template-select__card {
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

  &.is-selected {
    border-color: #409eff;
    box-shadow: 0 0 0 1px #409eff inset;
  }
}

.template-select__thumb {
  font-size: 36px;
  line-height: 1;
  margin-bottom: 4px;
}

.template-select__name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.template-select__desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>
