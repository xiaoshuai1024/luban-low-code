<script setup lang="ts">
/**
 * LubanModal — 模态对话框物料组件（feedback/modal）。
 *
 * 轻量自研实现（Material Design 风格），不依赖 element-plus。
 * visible 受控（v-model:visible），通过 open/close 事件对外通知。
 * width 接受任意 CSS 宽度（'50%' / '480px' 等）。
 *
 * a11y：role="dialog" + aria-modal + aria-labelledby；ESC 关闭（focus trap 暂未实现，
 * 后续可在样式面板波次或 a11y 专项补全）。
 */
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    visible?: boolean;
    width?: string;
  }>(),
  {
    title: '',
    visible: false,
    width: '50%',
  }
);

const emit = defineEmits<{
  /** 对话框打开后触发 */
  open: [];
  /** 对话框关闭后触发 */
  close: [];
  /** visible 变更（v-model:visible） */
  'update:visible': [value: boolean];
}>();

watch(
  () => props.visible,
  (next, prev) => {
    if (next && !prev) emit('open');
    if (!next && prev) emit('close');
  }
);

function close(): void {
  emit('update:visible', false);
}

function onMaskClick(): void {
  close();
}

function stop(e: Event): void {
  e.stopPropagation();
}

// a11y (L1): ESC closes the modal while it is visible.
function onKeydown(e: KeyboardEvent): void {
  if (props.visible && e.key === 'Escape') {
    e.preventDefault();
    close();
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

// aria-labelledby points at the title when present (otherwise aria-label is used).
const titleId = computed(() => 'lb-modal-title');
</script>

<template>
  <teleport to="body">
    <transition name="lb-modal">
      <div
        v-if="visible"
        class="lb-modal__mask"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        :aria-label="title ? undefined : '对话框'"
        @click="onMaskClick"
      >
        <div
          class="lb-modal"
          :style="{ width }"
          @click="stop"
        >
          <div class="lb-modal__header">
            <span :id="titleId" class="lb-modal__title">{{ title }}</span>
            <button
              type="button"
              class="lb-modal__close"
              aria-label="关闭"
              @click="close"
            >
              ×
            </button>
          </div>
          <div class="lb-modal__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="lb-modal__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped lang="scss">
// TODO(design-token): 当前 luban-low-code 物料硬编码色值/圆角；
// 待 luban-base 暴露可跨包消费的 token 入口（scss alias 或 CSS 变量）后迁移。
.lb-modal__mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.lb-modal {
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  &__title {
    font-size: 16px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
  }

  &__close {
    appearance: none;
    background: transparent;
    border: none;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.54);
    padding: 0 4px;

    &:hover {
      color: rgba(0, 0, 0, 0.87);
    }
  }

  &__body {
    padding: 20px;
    overflow: auto;
    flex: 1;
    color: rgba(0, 0, 0, 0.87);
  }

  &__footer {
    padding: 12px 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    text-align: right;
  }
}

.lb-modal-enter-active,
.lb-modal-leave-active {
  transition: opacity 0.2s ease;
}

.lb-modal-enter-from,
.lb-modal-leave-to {
  opacity: 0;
}
</style>
