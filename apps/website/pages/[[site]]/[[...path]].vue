<script setup lang="ts">
import { LubanPage } from "luban-low-code";
import type { PageSchema } from "luban-low-code";

const route = useRoute();
const config = useRuntimeConfig().public;
const defaultSiteSlug = (config.defaultSiteSlug as string) || "default";

// 单站点：site 可能为空，用 defaultSiteSlug；多站点：site 为第一段
const siteSlug = (route.params.site as string) || defaultSiteSlug;
const pathSegments = (route.params.path as string[]) || [];
const path = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "/";

const { data: page, error, status } = usePageByPath(siteSlug, path);

const schema = computed<PageSchema | null>(() => page.value?.schema ?? null);

// BFF 无数据或 404 时展示错误
useHead({
  title: page.value?.name ?? "Page",
});
</script>

<template>
  <div class="luban-website-page">
    <template v-if="status === 'pending'">
      <div class="loading">Loading...</div>
    </template>
    <template v-else-if="error">
      <div class="error">
        <h1>Page not found</h1>
        <p>{{ error.message || "The requested page could not be loaded." }}</p>
      </div>
    </template>
    <template v-else-if="schema?.root">
      <ClientOnly>
        <LubanPage :schema="schema" />
        <template #fallback>
          <div class="loading">Loading...</div>
        </template>
      </ClientOnly>
    </template>
    <template v-else>
      <div class="error">
        <h1>Page not found</h1>
        <p>No content available for this path.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.luban-website-page {
  min-height: 100vh;
}
.loading,
.error {
  padding: 2rem;
  text-align: center;
}
.error {
  color: #c00;
}
</style>
