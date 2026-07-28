/**
 * V2-T10 analytics 事件追踪 composable — track(event, payload)。
 *
 * 统一事件分发到已加载的第三方 SDK：
 *  - GA4: window.gtag('event', name, params)
 *  - Facebook Pixel: window.fbq('track', name, params)（标准事件名映射）
 *  - 百度统计：自动 _hmt._trackEvent（百度无标准电商事件，用自定义事件）
 *
 * SDK 未加载（无配置/SSR）时 track 为 noop，不报错。
 *
 * 标准事件名（业务层调用）：
 *  - page_view：页面浏览（路由切换/首屏）
 *  - lead_submit：留资表单提交成功
 *  - cta_click：CTA 按钮点击
 *  - generate_lead：留资成功（GA4/Pixel 标准转化事件）
 *
 * 用法：
 *   const { track } = useAnalyticsTrack();
 *   track('lead_submit', { formId: 'f1', phone: '***' });
 */
import type { SiteAnalytics } from '~/utils/analytics'

export type AnalyticsEvent =
  | 'page_view'
  | 'lead_submit'
  | 'cta_click'
  | 'generate_lead'
  | string

/** GA4/Pixel 标准事件名映射（业务事件 → 平台标准事件） */
const PIXEL_EVENT_MAP: Record<string, string> = {
  lead_submit: 'Lead',
  generate_lead: 'Lead',
  cta_click: 'Contact',
  page_view: 'PageView',
}

/** 百度统计 _trackEvent 参数：category / action / opt_label / opt_value */
const BAIDU_CATEGORY = 'luban'

export interface AnalyticsTrackOptions {
  /** 站点 analytics 配置（决定哪些 SDK 接收事件） */
  analytics?: SiteAnalytics | null
}

/**
 * 创建 track 函数。绑定到给定 analytics 配置。
 * 在 default.vue layout 注入后，全站组件可用 useAnalyticsTrack()。
 */
export function useAnalyticsTrack(options: AnalyticsTrackOptions = {}) {
  function track(event: AnalyticsEvent, payload: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return // SSR 安全
    const a = options.analytics

    // GA4
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
    if (gtag && a?.ga4?.measurementId) {
      gtag('event', event, payload)
    }

    // Facebook Pixel
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq
    if (fbq && a?.facebook?.pixelId) {
      const pixelEvent = PIXEL_EVENT_MAP[event] ?? event
      fbq('track', pixelEvent, payload)
    }

    // 百度统计
    const _hmt = (window as unknown as { _hmt?: { push: (...args: unknown[]) => void } })._hmt
    if (_hmt && a?.baidu?.id) {
      _hmt.push(['_trackEvent', BAIDU_CATEGORY, event, String(payload.formId ?? payload.label ?? ''), String(payload.value ?? '')])
    }
  }

  return { track }
}
