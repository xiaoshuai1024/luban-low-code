<script setup lang="ts">
/**
 * Default layout — page transitions + analytics.
 */
import { buildAnalyticsScripts } from '~/composables/useAnalytics'
import type { SiteAnalytics } from '~/utils/analytics'

const config = useRuntimeConfig()
const slug = config.public.defaultSiteSlug || 'default'
const bffBase = (config.public.bffBaseUrl as string)?.replace(/\/$/, '') || 'http://127.0.0.1:3100'

const siteConfig = await useFetch<{ analytics?: SiteAnalytics }>(
  `/api/public/sites/${encodeURIComponent(slug)}/config`,
  {
    baseURL: bffBase,
    default: () => ({ analytics: {} }),
    lazy: false,
  }
).data

const analytics = computed<SiteAnalytics | null>(() => siteConfig.value?.analytics ?? null)

useHead(() => {
  const { script } = buildAnalyticsScripts(analytics.value)
  return { script: script.length ? script : undefined }
})
</script>

<template>
  <div class="layout-default">
    <slot />
  </div>
</template>

<style>
.layout-default {
  min-height: 100vh;
}
</style>
