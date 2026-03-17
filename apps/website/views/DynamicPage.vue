<script setup lang="ts">
import { LubanPage } from "luban-low-code";
import type { PageSchema } from "luban-low-code";
import { DEFAULT_SITE_SLUG } from "~/utils/routes";
import { useSitePageStore } from "~/stores/sitePage";

const props = withDefaults(
  defineProps<{ site?: string; path?: string }>(),
  { site: "", path: "/" }
);

const config = useRuntimeConfig().public;
const defaultSiteSlug = (config.defaultSiteSlug as string) || DEFAULT_SITE_SLUG;
const sitePageStore = useSitePageStore();

const siteSlug = computed(() => props.site || defaultSiteSlug);
const path = computed(() => {
  const p = props.path;
  if (!p || p === "") return "/";
  return p.startsWith("/") ? p : `/${p}`;
});

const { data: page, error, status } = usePageByPath(siteSlug, path);

const schema = computed<PageSchema | null>(() => page.value?.schema ?? null);

watch([page, error], () => {
  sitePageStore.setPage(siteSlug.value, path.value, page.value ?? null, error.value ?? null);
}, { immediate: true });

onBeforeUnmount(() => {
  sitePageStore.clearPage();
});

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
