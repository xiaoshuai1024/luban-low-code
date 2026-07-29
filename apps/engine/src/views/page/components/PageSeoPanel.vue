<script setup lang="ts">
/**
 * PageSeoPanel.vue — V2-T2 页面级 SEO 元信息配置面板。
 *
 * 与 PropertyPanel（节点级）分离：SEO 归属 PageSchema.seo（页面级），
 * 不属于任一节点。本组件作为独立折叠分区，由 PageEditor 在右侧栏渲染。
 *
 * 字段（与 luban-low-code PageSeo 接口对齐）：
 *   title / description / keywords[] / ogTitle / ogDescription / ogImage
 *   canonical / noIndex
 *
 * 双向：props.seo 为 PageSeo；emit 'update:seo' 透传新对象到 PageEditor，
 * PageEditor 写入 schema.value.seo 并在 save/publish 时透传给后端。
 *
 * FeatureGate：VITE_FEATURE_SEO 关闭时 PageEditor 不渲染本面板。
 */
import { computed } from 'vue'
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElSwitch,
  ElTag,
} from 'element-plus'
import type { PageSeo } from '@/types/schema'

const props = defineProps<{
  seo?: PageSeo
}>()

const emit = defineEmits<{
  (e: 'update:seo', seo: PageSeo): void
}>()

/** 可变副本：所有写入先克隆再 emit，保证父组件响应式更新 */
const draft = computed<PageSeo>(() => ({
  title: props.seo?.title ?? '',
  description: props.seo?.description ?? '',
  keywords: props.seo?.keywords ?? [],
  ogTitle: props.seo?.ogTitle ?? '',
  ogDescription: props.seo?.ogDescription ?? '',
  ogImage: props.seo?.ogImage ?? '',
  canonical: props.seo?.canonical ?? '',
  noIndex: props.seo?.noIndex ?? false,
}))

function emitPatch(patch: Partial<PageSeo>): void {
  emit('update:seo', { ...draft.value, ...patch })
}

/** keywords 文本输入：逗号分隔 ↔ 数组 */
const keywordsText = computed<string>({
  get() {
    return (draft.value.keywords ?? []).join(', ')
  },
  set(v: string) {
    const arr = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    emitPatch({ keywords: arr })
  },
})
</script>

<template>
  <div class="page-seo-panel">
    <div class="page-seo-panel__header">
      <span class="page-seo-panel__title">SEO 元信息</span>
      <ElTag v-if="draft.noIndex" size="small" type="warning">noindex</ElTag>
    </div>
    <ElForm label-position="top" size="small">
      <ElFormItem label="页面标题 (title)">
        <ElInput
          :model-value="draft.title"
          placeholder="浏览器标签 & 搜索结果标题"
          maxlength="120"
          show-word-limit
          @update:model-value="(v: string) => emitPatch({ title: v })"
        />
      </ElFormItem>
      <ElFormItem label="描述 (description)">
        <ElInput
          :model-value="draft.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="搜索结果摘要，建议 ≤160 字"
          maxlength="200"
          show-word-limit
          @update:model-value="(v: string) => emitPatch({ description: v })"
        />
      </ElFormItem>
      <ElFormItem label="关键词 (keywords)">
        <ElInput
          :model-value="keywordsText"
          placeholder="逗号分隔，如 营销,建站,低代码"
          @update:model-value="(v: string) => (keywordsText = v)"
        />
      </ElFormItem>

      <div class="page-seo-panel__sub">社交分享 (Open Graph)</div>
      <ElFormItem label="OG 标题">
        <ElInput
          :model-value="draft.ogTitle"
          placeholder="不填则回退 title"
          @update:model-value="(v: string) => emitPatch({ ogTitle: v })"
        />
      </ElFormItem>
      <ElFormItem label="OG 描述">
        <ElInput
          :model-value="draft.ogDescription"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 3 }"
          placeholder="不填则回退 description"
          @update:model-value="(v: string) => emitPatch({ ogDescription: v })"
        />
      </ElFormItem>
      <ElFormItem label="OG 图片 URL">
        <ElInput
          :model-value="draft.ogImage"
          placeholder="https://.../cover.png（建议 1200×630）"
          @update:model-value="(v: string) => emitPatch({ ogImage: v })"
        />
      </ElFormItem>

      <div class="page-seo-panel__sub">高级</div>
      <ElFormItem label="Canonical 链接">
        <ElInput
          :model-value="draft.canonical"
          placeholder="https://example.com/page（规范链接）"
          @update:model-value="(v: string) => emitPatch({ canonical: v })"
        />
      </ElFormItem>
      <ElFormItem label="禁止索引 (noindex)">
        <ElSwitch
          :model-value="draft.noIndex"
          @update:model-value="(v: string | number | boolean) => emitPatch({ noIndex: Boolean(v) })"
        />
        <span class="page-seo-panel__hint">勾选后搜索引擎不收录本页</span>
      </ElFormItem>

      <div v-if="draft.ogImage" class="page-seo-panel__preview">
        <div class="page-seo-panel__preview-label">OG 预览</div>
        <div class="page-seo-panel__preview-card">
          <img :src="draft.ogImage" alt="OG preview" class="page-seo-panel__preview-img" />
          <div class="page-seo-panel__preview-text">
            <div class="page-seo-panel__preview-title">{{ draft.ogTitle || draft.title || '无标题' }}</div>
            <div class="page-seo-panel__preview-desc">{{ draft.ogDescription || draft.description || '无描述' }}</div>
          </div>
        </div>
      </div>
    </ElForm>
  </div>
</template>

<style lang="scss" scoped>
.page-seo-panel {
  padding: 12px;
  box-sizing: border-box;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid #ebeef5;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  &__sub {
    font-size: 12px;
    font-weight: 600;
    color: #909399;
    margin: 12px 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__hint {
    font-size: 12px;
    color: #909399;
    margin-left: 8px;
  }

  &__preview {
    margin-top: 12px;
  }

  &__preview-label {
    font-size: 12px;
    color: #909399;
    margin-bottom: 6px;
  }

  &__preview-card {
    border: 1px solid #ebeef5;
    border-radius: 6px;
    overflow: hidden;
    max-width: 100%;
  }

  &__preview-img {
    width: 100%;
    max-height: 120px;
    object-fit: cover;
    display: block;
    background: #f5f7fa;
  }

  &__preview-text {
    padding: 8px 10px;
  }

  &__preview-title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__preview-desc {
    font-size: 12px;
    color: #606266;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
