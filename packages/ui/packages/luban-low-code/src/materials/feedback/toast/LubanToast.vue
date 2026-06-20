<script setup lang="ts">
/**
 * LubanToast — 全局提示物料组件（feedback/toast）。
 *
 * 轻量自研实现（Material Design 风格），不依赖 element-plus 的 ElMessage。
 * 双形态：
 *  1. 物料态/设计期：把 message/type/duration 作为受控 props 渲染一条静态预览
 *     （画布上可见当前文案与类型样式）；
 *  2. 运行时命令式：组件实例暴露 show(msg?, type?, duration?) 方法，由事件
 *     动作调用，从屏幕顶部滑入并在 duration 毫秒后自动消失。
 */
import { ref, watch, onBeforeUnmount } from 'vue';

type ToastType = 'success' | 'warning' | 'info' | 'error';

const props = withDefaults(
  defineProps<{
    message?: string;
    type?: ToastType;
    duration?: number;
  }>(),
  {
    message: '',
    type: 'info',
    duration: 3000,
  }
);

const visible = ref(false);
// hidden 显式覆盖物料态预览：hide() 调用后即使 message 非空也不渲染，
// 直到 show() 再次被调用。避免命令式 hide 与「message 非空即预览」冲突。
const hidden = ref(false);
const currentMessage = ref(props.message);
const currentType = ref<ToastType>(props.type);
let timer: ReturnType<typeof setTimeout> | undefined;

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
}

function show(
  msg?: string,
  type?: ToastType,
  duration?: number
): void {
  clearTimer();
  hidden.value = false;
  currentMessage.value = msg ?? props.message;
  currentType.value = type ?? props.type;
  visible.value = true;
  const d = duration ?? props.duration;
  if (d > 0) {
    timer = setTimeout(() => {
      visible.value = false;
    }, d);
  }
}

function hide(): void {
  clearTimer();
  visible.value = false;
  hidden.value = true;
}

// 物料态预览：message 变化时同步展示（不自动消失，便于设计期观察）。
watch(
  () => props.message,
  (m) => {
    currentMessage.value = m;
    hidden.value = false;
  }
);
watch(
  () => props.type,
  (t) => {
    currentType.value = t;
  }
);

onBeforeUnmount(() => clearTimer());

defineExpose({ show, hide });
</script>

<template>
  <transition name="lb-toast">
    <div
      v-if="!hidden && (visible || message)"
      class="lb-toast"
      :class="`lb-toast--${currentType}`"
      role="alert"
    >
      <span class="lb-toast__icon">{{ { success: '✓', warning: '!', error: '×', info: 'i' }[currentType] }}</span>
      <span class="lb-toast__message">{{ currentMessage }}</span>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.lb-toast {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 4px;
  font-size: 14px;
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

  &--success {
    background: #2e7d32;
  }

  &--warning {
    background: #ed6c02;
  }

  &--error {
    background: #d32f2f;
  }

  &--info {
    background: #0288d1;
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    font-weight: 600;
    font-size: 12px;
  }

  &__message {
    line-height: 1.4;
  }
}

.lb-toast-enter-active,
.lb-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.lb-toast-enter-from,
.lb-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
