<script setup lang="ts">
import { computed } from 'vue';

type PanelSize = 'small' | 'medium' | 'large';

const props = withDefaults(
  defineProps<{
    /** v-model:visible */
    modelValue?: boolean;
    /** 标题：会展示在 header 左侧 */
    title?: string;
    /** 面板宽度尺寸；默认中号，约 640px */
    size?: PanelSize;
    /** 是否显示右上角关闭按钮 */
    closable?: boolean;
  }>(),
  {
    modelValue: true,
    size: 'medium',
    closable: true,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const isVisible = computed(() => props.modelValue !== false);

function closePanel() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <div v-if="isVisible" class="lb-side-panel-overlay">
    <aside
      class="lb-side-panel"
      :class="[`lb-side-panel--size-${size}`]"
      role="dialog"
      aria-modal="true"
    >
      <header class="lb-side-panel__header">
        <div class="lb-side-panel__header-main">
          <slot name="header">
            <h2 v-if="title" class="lb-side-panel__title">
              {{ title }}
            </h2>
          </slot>
        </div>
        <button
          v-if="closable"
          type="button"
          class="lb-side-panel__close"
          aria-label="关闭"
          @click="closePanel"
        >
          ✕
        </button>
      </header>
      <section class="lb-side-panel__body">
        <slot name="body">
          <slot />
        </slot>
      </section>
      <footer class="lb-side-panel__footer">
        <slot name="footer" />
      </footer>
    </aside>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as v;

.lb-side-panel-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background-color: rgba(0, 0, 0, 0.32);
  z-index: 1300;
}

.lb-side-panel {
  height: 100%;
  background-color: v.$lb-surface;
  color: v.$lb-text-primary;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06),
    0 10px 24px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: v.$lb-spacing-unit * 2;

  &.lb-side-panel--size-small {
    width: 480px;
    max-width: min(480px, 100%);
  }

  &.lb-side-panel--size-medium {
    width: 640px;
    max-width: min(640px, 100%);
  }

  &.lb-side-panel--size-large {
    width: 800px;
    max-width: min(800px, 100%);
  }
}

.lb-side-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: v.$lb-spacing-unit * 2;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.lb-side-panel__header-main {
  display: flex;
  align-items: center;
  gap: v.$lb-spacing-unit;
  min-width: 0;
}

.lb-side-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: v.$lb-text-primary;
}

.lb-side-panel__close {
  border: none;
  background: transparent;
  color: v.$lb-text-secondary;
  cursor: pointer;
  padding: v.$lb-spacing-unit;
  border-radius: 999px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
}

.lb-side-panel__body {
  flex: 1;
  overflow: auto;
  padding-block: v.$lb-spacing-unit * 2;
}

.lb-side-panel__footer {
  padding-top: v.$lb-spacing-unit * 1.5;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

@media (max-width: 768px) {
  .lb-side-panel {
    width: 100%;
    max-width: 100%;
  }
}
</style>

