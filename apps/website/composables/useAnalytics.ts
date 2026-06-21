/**
 * V2-T10 analytics composable — 站点级埋点 SDK 脚本注入。
 *
 * 在 layout/default.vue 调用 useHead 注入 GA4 / 百度统计 / Facebook Pixel 脚本。
 * 配置来自公开端点 /api/public/sites/:slug/config（SSR 预取）。
 *
 * 无配置时不注入任何脚本（零开销）；仅注入已配置平台的 SDK。
 */
import type { SiteAnalytics } from '~/utils/analytics'

/**
 * 把 analytics 配置转为 useHead 的 script 标签数组。
 * 各平台 SDK 脚本片段：
 *  - GA4: https://www.googletagmanager.com/gtag/js + gtag init
 *  - 百度统计: https://hm.baidu.com/hm.js?<id>
 *  - Facebook Pixel: connect.facebook.net/en_US/fbevents.js + fbq init
 */
export function buildAnalyticsScripts(a: SiteAnalytics | null | undefined): {
  script: { src?: string; innerHTML?: string; [k: string]: unknown }[]
} {
  if (!a) return { script: [] }
  const scripts: { src?: string; innerHTML?: string; [k: string]: unknown }[] = []

  // GA4
  if (a.ga4?.measurementId) {
    const mid = a.ga4.measurementId
    scripts.push({ src: `https://www.googletagmanager.com/gtag/js?id=${mid}`, async: true })
    scripts.push({
      innerHTML: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${mid}');`,
    })
  }

  // 百度统计
  if (a.baidu?.id) {
    const bid = a.baidu.id
    scripts.push({
      innerHTML: `var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?${bid}";
  hm.async = 1;
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`,
    })
  }

  // Facebook Pixel
  if (a.facebook?.pixelId) {
    const pid = a.facebook.pixelId
    scripts.push({
      innerHTML: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pid}');
fbq('track', 'PageView');`,
    })
  }

  return { script: scripts }
}
