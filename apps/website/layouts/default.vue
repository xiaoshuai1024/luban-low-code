<template>
  <slot />
</template>

<script setup lang="ts">
/**
 * V2-T10 default layout — 站点级 analytics SDK 注入。
 *
 * SSR 预取公开 site config（含 analytics 配置），用 useHead 注入第三方 SDK 脚本。
 * 配置为空时不注入（零开销）。
 */
import { buildAnalyticsScripts } from '~/composables/useAnalytics'
import type { SiteAnalytics } from '~/utils/analytics'

const config = useRuntimeConfig()
const slug = config.public.defaultSiteSlug || 'default'
const bffBase = (config.public.bffBaseUrl as string)?.replace(/\/$/, '') || 'http://127.0.0.1:3100'

// SSR 预取站点配置（analytics）；失败降级为空（不阻塞渲染）
// baseURL 须指向 BFF（3100），否则打到 website 自身返回 HTML
const siteConfig = await useFetch<{ analytics?: SiteAnalytics }>(
  `/api/public/sites/${encodeURIComponent(slug)}/config`,
  {
    baseURL: bffBase,
    default: () => ({ analytics: {} }),
    lazy: false,
  }
).data

const analytics = computed<SiteAnalytics | null>(() => siteConfig.value?.analytics ?? null)

// 注入 SDK 脚本（无配置时为空数组，不注入）
useHead(() => {
  const { script } = buildAnalyticsScripts(analytics.value)
  return {
    script: script.length ? script : undefined,
  }
})
</script>
