<script setup lang="ts">
/**
 * LubanBackToTop — 页面滚动后显示回到顶部浮动按钮。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    visibilityHeight?: number;
    right?: string;
    bottom?: string;
    duration?: number;
  }>(),
  {
    visibilityHeight: 300,
    right: '40px',
    bottom: '40px',
    duration: 300,
  },
);

const visible = ref(false);

/** 进行中的滚动动画帧 id（重复点击/卸载时取消，避免动画叠加） */
let rafId = 0;

function onScroll() {
  visible.value = window.scrollY > props.visibilityHeight;
}

/** easeOutCubic：先快后慢，与浏览器 smooth 滚动观感一致 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 按 duration(ms) 插值滚动回顶部。
 * window.scrollTo 无 duration 参数（behavior 只有 auto/smooth），
 * 故用 requestAnimationFrame 手写缓动；duration<=0 时直接跳顶。
 */
function scrollToTop() {
  const start = window.scrollY;
  if (start <= 0) return;
  const duration = Math.max(props.duration ?? 0, 0);
  cancelAnimationFrame(rafId);

  if (duration <= 0 || typeof requestAnimationFrame !== 'function') {
    window.scrollTo(0, 0);
    return;
  }

  const startTime = performance.now();
  // 用 performance.now() 取时序而非 rAF 回调入参：部分环境（如 jsdom
  // 非 visual 模式）回调不传时间戳，入参会是 undefined 导致插值 NaN。
  const step = () => {
    const t = Math.min((performance.now() - startTime) / duration, 1);
    window.scrollTo(0, start * (1 - easeOutCubic(t)));
    if (t < 1) rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  cancelAnimationFrame(rafId);
});
</script>

<template>
  <Transition name="lb-btt-fade">
    <button
      v-if="visible"
      class="lb-back-to-top"
      :style="{ right, bottom }"
      aria-label="回到顶部"
      @click="scrollToTop"
    >
      ↑
    </button>
  </Transition>
</template>

<style lang="scss" scoped>
.lb-back-to-top {
  position: fixed;
  z-index: 1000;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #1976d2;
  color: #fff;
  border: none;
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  &:hover { background: #1565c0; }
}

.lb-btt-fade-enter-active, .lb-btt-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.lb-btt-fade-enter-from, .lb-btt-fade-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
