<script setup lang="ts">
// 首页：重定向到默认站点根路径（由 [[site]]/[[...path]] 渲染）
const config = useRuntimeConfig().public;
const defaultSlug = (config.defaultSiteSlug as string) || "default";

await navigateTo(`/${defaultSlug}/`, { replace: true });
</script>

<template>
  <div class="loading">Redirecting...</div>
</template>

<style scoped>
.loading {
  padding: 2rem;
  text-align: center;
}
</style>
