<script setup lang="ts">
/**
 * LubanContentList.vue — V2-T7 CMS 内容列表渲染组件。
 *
 * 接收 items（CMS 绑定 list 模式注入的 CollectionItemData[]），
 * 按 itemTemplate 配置渲染每条内容。支持标题/正文/图片/链接 字段映射。
 *
 * 用法（schema）：
 *   { type: 'LubanContentList', cmsBinding: { collectionId, mode: 'list' },
 *     props: { titleKey:'title', bodyKey:'body', imageKey:'cover', linkKey:'url', columns:2 } }
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** CMS 绑定注入的 items（每条为 { [fieldKey]: unknown }） */
    items?: Record<string, unknown>[]
    /** 标题字段 key */
    titleKey?: string
    /** 正文字段 key */
    bodyKey?: string
    /** 图片字段 key */
    imageKey?: string
    /** 链接字段 key（点击跳转） */
    linkKey?: string
    /** 列数（响应式 auto-fit，默认 3） */
    columns?: number
    /** 空状态文案 */
    emptyText?: string
  }>(),
  { items: () => [], columns: 3, emptyText: '暂无内容' }
)

type Card = {
  title: string
  body: string
  image?: string
  link?: string
}

const cards = computed<Card[]>(() =>
  (props.items ?? []).map((it) => ({
    title: String(it[props.titleKey ?? 'title'] ?? ''),
    body: String(it[props.bodyKey ?? 'body'] ?? ''),
    image: it[props.imageKey ?? 'image'] ? String(it[props.imageKey ?? 'image']) : undefined,
    link: it[props.linkKey ?? 'link'] ? String(it[props.linkKey ?? 'link']) : undefined,
  }))
)
</script>

<template>
  <div class="lb-content-list">
    <div v-if="cards.length === 0" class="lb-content-list__empty">{{ emptyText }}</div>
    <div
      v-else
      class="lb-content-list__grid"
      :style="{ '--lb-cl-cols': columns }"
    >
      <component
        :is="card.link ? 'a' : 'div'"
        v-for="(card, i) in cards"
        :key="i"
        class="lb-content-list__card"
        :href="card.link || undefined"
      >
        <img
          v-if="card.image"
          :src="card.image"
          :alt="card.title"
          class="lb-content-list__img"
          loading="lazy"
        />
        <div class="lb-content-list__body">
          <h3 v-if="card.title" class="lb-content-list__title">{{ card.title }}</h3>
          <p v-if="card.body" class="lb-content-list__text">{{ card.body }}</p>
        </div>
      </component>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.lb-content-list {
  width: 100%;

  &__empty {
    padding: 48px 24px;
    text-align: center;
    color: var(--lb-text-muted, #6b7280);
    font-size: 14px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
  }

  &__card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--lb-border, #e5e7eb);
    border-radius: 10px;
    overflow: hidden;
    background: var(--lb-bg, #fff);
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.2s, transform 0.2s;

    &:hover {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
    }
  }

  &__img {
    width: 100%;
    height: 160px;
    object-fit: cover;
    display: block;
    background: var(--lb-bg-muted, #f9fafb);
  }

  &__body {
    padding: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--lb-text-heading, #111827);
  }

  &__text {
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
    color: var(--lb-text-body, #374151);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
</style>
