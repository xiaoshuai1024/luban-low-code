<script setup lang="ts">
/**
 * LubanDrawer — 抽屉物料组件（feedback/drawer）。
 *
 * 轻量自研实现（Material Design 风格），不依赖 element-plus。
 * visible 受控（v-model:visible），placement 控制滑出方向，
 * size 表示抽屉尺寸（横向=宽度，纵向=高度）。
 *
 * a11y：role="dialog" + aria-modal + aria-label/aria-labelledby；ESC 关闭。
 */
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';

type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom';

const props = withDefaults(
  defineProps<{
    title?: string;
    visible?: boolean;
    placement?: DrawerPlacement;
    size?: string;
  }>(),
  {
    title: '',
    visible: false,
    placement: 'right',
    size: '30%',
  }
);

const emit = defineEmits<{
  open: [];
  close: [];
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

function panelStyle(): Record<string, string> {
  const horizontal = props.placement === 'left' || props.placement === 'right';
  return horizontal ? { width: props.size } : { height: props.size };
}

// a11y (L1): ESC closes the drawer while it is visible.
function onKeydown(e: KeyboardEvent): void {
  if (props.visible && e.key === 'Escape') {
    e.preventDefault();
    close();
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

const titleId = computed(() => 'lb-drawer-title');
</script>

<template>
  <teleport to="body">
    <transition name="lb-drawer">
      <div
        v-if="visible"
        class="lb-drawer__mask"
        :class="`lb-drawer__mask--${placement}`"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        :aria-label="title ? undefined : '抽屉'"
        @click="onMaskClick"
      >
        <div
          class="lb-drawer"
          :class="`lb-drawer--${placement}`"
          :style="panelStyle()"
          @click="stop"
        >
          <div class="lb-drawer__header">
            <span :id="titleId" class="lb-drawer__title">{{ title }}</span>
            <button
              type="button"
              class="lb-drawer__close"
              aria-label="关闭"
              @click="close"
            >
              ×
            </button>
          </div>
          <div class="lb-drawer__body">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped lang="scss">
// TODO(design-token): 当前 luban-low-code 物料硬编码色值/圆角；
// 待 luban-base 暴露可跨包消费的 token 入口（scss alias 或 CSS 变量）后迁移。
.lb-drawer__mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
}

.lb-drawer__mask--right {
  justify-content: flex-end;
}

.lb-drawer__mask--left {
  justify-content: flex-start;
}

.lb-drawer__mask--top {
  align-items: flex-start;
}

.lb-drawer__mask--bottom {
  align-items: flex-end;
}

.lb-drawer {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &--right,
  &--left {
    height: 100%;
  }

  &--top,
  &--bottom {
    width: 100%;
  }

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
}

.lb-drawer-enter-active,
.lb-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.lb-drawer-enter-from,
.lb-drawer-leave-to {
  opacity: 0;
}
</style>
