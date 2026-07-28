<script setup>
// luban-low-code 组件通过 RuntimeRenderer 动态渲染，
// Nuxt/Vite CSS tree-shaking 无法自动收集 scoped 样式。
// 全局导入所有物料组件 CSS（含 luban-base 基础组件样式）。
import '../../packages/ui/packages/luban-base/dist/index.css';
import '../../packages/ui/packages/luban-low-code/dist/index.css';
</script>

<template>
  <NuxtPage />
</template>
