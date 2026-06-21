/**
 * V2-T10 analytics 插件 — 提供 $analytics.track 全局方法 + 自动 page_view 追踪。
 *
 * 注入 useAnalyticsTrack（绑定站点 analytics 配置），组件可直接：
 *   const { $analytics } = useNuxtApp();
 *   $analytics.track('cta_click', { label: 'hero' });
 *
 * 自动追踪：路由切换时触发 page_view（SPA 导航）。
 */
import { useAnalyticsTrack } from '~/composables/useAnalyticsTrack'
import type { SiteAnalytics } from '~/utils/analytics'

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const slug = config.public.defaultSiteSlug || 'default'

  // 预取站点 analytics 配置（与 default.vue layout 同源）
  let analytics: SiteAnalytics | null = null
  try {
    const siteConfig = await $fetch<{ analytics?: SiteAnalytics }>(
      `/api/public/sites/${encodeURIComponent(slug)}/config`
    )
    analytics = siteConfig?.analytics ?? null
  } catch {
    analytics = null
  }

  const { track } = useAnalyticsTrack({ analytics })

  // 注入全局 $analytics
  nuxtApp.provide('analytics', { track })

  // 自动 page_view：首屏 + 路由切换
  const router = useRouter()
  router.afterEach(() => {
    nextTick(() => track('page_view', { path: router.currentRoute.value.fullPath }))
  })
})
