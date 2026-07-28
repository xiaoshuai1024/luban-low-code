<script setup lang="ts">
/**
 * DesignerLayout.vue — 全屏沉浸式设计器布局
 *
 * 不含侧边栏和顶部导航，最大化画布工作区。
 * 仅在 PageEditor 设计模式下使用，保证可见即所得。
 */
</script>

<template>
  <div class="designer-layout">
    <router-view />
  </div>
</template>

<style lang="scss" scoped>
.designer-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #f0f2f5;
}
</style>
