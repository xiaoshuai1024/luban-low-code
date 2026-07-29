<script setup lang="ts">
/**
 * LubanAlert — 提示信息块（4 种变体：info/warning/error/success）。
 *
 * 可用作文档 callout、表单提示、全局通知等。
 */
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    content?: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    closable?: boolean;
    showIcon?: boolean;
  }>(),
  {
    title: '',
    content: '',
    type: 'info',
    closable: false,
    showIcon: true,
  },
);

const visible = ref(true);

const icon = computed(() => {
  const map: Record<string, string> = {
    info: 'ℹ',
    warning: '⚠',
    error: '✕',
    success: '✓',
  };
  return map[props.type] || map.info;
});

const colorVars = computed(() => {
  const map: Record<string, string> = {
    info: '#1976d2',
    warning: '#f57c00',
    error: '#d32f2f',
    success: '#388e3c',
  };
  const c = map[props.type] || map.info;
  return {
    '--lb-alert-color': c,
    '--lb-alert-bg': `${c}0d`,
    '--lb-alert-border': `${c}30`,
    '--lb-alert-icon': c,
  } as Record<string, string>;
});

function close() {
  visible.value = false;
}
</script>

<template>
  <div v-if="visible" class="lb-alert" :class="`lb-alert--${type}`" :style="colorVars">
    <span v-if="showIcon" class="lb-alert__icon">{{ icon }}</span>
    <div class="lb-alert__body">
      <div v-if="title" class="lb-alert__title">{{ title }}</div>
      <div v-if="content" class="lb-alert__content">{{ content }}</div>
      <slot />
    </div>
    <button v-if="closable" class="lb-alert__close" @click="close">×</button>
  </div>
</template>

<style lang="scss" scoped>
.lb-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--lb-alert-border);
  background: var(--lb-alert-bg);
  color: rgba(0, 0, 0, 0.87);
  font-size: 14px;
  line-height: 1.5;

  &__icon {
    font-size: 18px;
    color: var(--lb-alert-color);
    flex-shrink: 0;
    line-height: 1.4;
  }
  &__body {
    flex: 1;
  }
  &__title {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--lb-alert-color);
  }
  &__content {
    color: rgba(0, 0, 0, 0.6);
  }
  &__close {
    appearance: none;
    background: transparent;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
    line-height: 1;
    &:hover { color: rgba(0, 0, 0, 0.8); }
  }
}
</style>
