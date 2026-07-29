<script setup lang="ts">
/**
 * LubanSteps — 步骤流程组件（水平/垂直）。
 *
 * 每步含数字圆点、标题、描述。current 步高亮为激活态（蓝色填充）。
 */
interface StepItem {
  title: string;
  description?: string;
  icon?: string;
}

const props = withDefaults(
  defineProps<{
    items?: StepItem[];
    direction?: 'horizontal' | 'vertical';
    current?: number;
  }>(),
  {
    items: () => [],
    direction: 'horizontal',
    current: 0,
  },
);
</script>

<template>
  <div
    class="lb-steps"
    :class="`lb-steps--${direction}`"
    role="list"
  >
    <div
      v-for="(item, idx) in items"
      :key="idx"
      class="lb-steps__item"
      :class="{
        'lb-steps__item--active': idx === current,
        'lb-steps__item--done': idx < current,
      }"
      role="listitem"
    >
      <div class="lb-steps__indicator">
        <span v-if="item.icon" class="lb-steps__icon">{{ item.icon }}</span>
        <span v-else class="lb-steps__number">{{ idx + 1 }}</span>
      </div>
      <div class="lb-steps__body">
        <div class="lb-steps__title">{{ item.title }}</div>
        <div v-if="item.description" class="lb-steps__desc">{{ item.description }}</div>
      </div>
      <div v-if="idx < items.length - 1" class="lb-steps__connector" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.lb-steps {
  display: flex;
  gap: 0;

  &--horizontal {
    flex-direction: row;
    .lb-steps__item { flex: 1; align-items: center; text-align: center; flex-direction: column; }
    .lb-steps__connector { width: 100%; height: 2px; margin: 0; position: absolute; top: 16px; left: 50%; z-index: 0; }
  }
  &--vertical {
    flex-direction: column;
    .lb-steps__item { align-items: flex-start; padding-bottom: 24px; }
    .lb-steps__connector { width: 2px; flex: 1; position: absolute; left: 15px; top: 36px; bottom: 0; z-index: 0; }
  }

  &__item {
    display: flex;
    gap: 12px;
    position: relative;
    &:last-child { .lb-steps__connector { display: none; } }
  }
  &__indicator {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.38);
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
    z-index: 1;
    transition: background 0.2s, color 0.2s;
  }
  &__item--active &__indicator {
    background: #1976d2;
    color: #fff;
  }
  &__item--done &__indicator {
    background: #e3f2fd;
    color: #1976d2;
  }
  &__body {
    flex: 1;
    min-width: 0;
  }
  &__title {
    font-weight: 600;
    font-size: 15px;
    color: rgba(0, 0, 0, 0.87);
  }
  &__desc {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.6);
    margin-top: 4px;
    line-height: 1.5;
  }
  &__connector {
    background: rgba(0, 0, 0, 0.12);
    transition: background 0.3s;
  }
  &__item--done &__connector {
    background: #1976d2;
  }
}
</style>
