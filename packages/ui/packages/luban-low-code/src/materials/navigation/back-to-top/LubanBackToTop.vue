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

function onScroll() {
  visible.value = window.scrollY > props.visibilityHeight;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
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
