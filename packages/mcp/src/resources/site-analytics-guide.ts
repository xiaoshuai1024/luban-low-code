/**
 * Site Analytics Guide — GA4、百度统计、Facebook Pixel 配置指南。
 *
 * Resource URI: luban://best-practices/site-analytics
 * MIME: text/markdown
 *
 * @since 0.1.0
 */

import type { ResourceDef } from './lib/resource-registry.js';

export const siteAnalyticsGuideResource: ResourceDef = {
  uri: 'luban://best-practices/site-analytics',
  name: '站点分析配置指南',
  description: 'GA4、百度统计、Facebook Pixel 等在 Luban 建站中的集成配置指南。',
  mimeType: 'text/markdown',
  load: () => `# 站点分析配置指南

在 Luban 低代码平台中，站点分析通过以下方式集成：

---

## 1. Google Analytics 4 (GA4)

### 获取 Measurement ID
1. 登录 [Google Analytics](https://analytics.google.com/)
2. 创建或选择 GA4 媒体资源
3. 进入 **管理 > 数据流 > 选择您的网站数据流**
4. 复制 **衡量 ID**（格式：\`G-XXXXXXXXXX\`）

### 配置方式
GA4 通过 Google 标签管理器（GTM）或直接插入 gtag.js 集成。在 Luban 平台中，通过站点设置添加：

\`\`\`html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
\`\`\`

### 事件追踪
在页面中注册自定义事件：

\`\`\`javascript
// 表单提交事件
gtag('event', 'form_submit', {
  'form_name': 'lead_capture',
  'form_location': 'homepage_hero'
});

// 按钮点击事件
gtag('event', 'button_click', {
  'button_name': 'cta_get_started',
  'button_location': 'pricing_section'
});

// 页面浏览（自动由 gtag.js 处理）
// ga 页面浏览事件自动发送
\`\`\`

### 转化跟踪
1. 在 GA4 中创建转化事件（如 \`form_submit\`）
2. 将事件标记为转化
3. 在 Luban 事件绑定中触发对应事件

### 增强电商功能
如需启用增强电商功能：

\`\`\`javascript
// 查看商品
gtag('event', 'view_item', {
  currency: 'CNY',
  value: 99.00,
  items: [{ item_id: 'SKU_001', item_name: '商品名称', price: 99.00 }]
});

// 加入购物车
gtag('event', 'add_to_cart', {
  currency: 'CNY',
  value: 99.00,
  items: [{ item_id: 'SKU_001', item_name: '商品名称', price: 99.00, quantity: 1 }]
});

// 完成购买
gtag('event', 'purchase', {
  transaction_id: 'TXN_001',
  currency: 'CNY',
  value: 99.00,
  items: [{ item_id: 'SKU_001', item_name: '商品名称', price: 99.00, quantity: 1 }]
});
\`\`\`

---

## 2. 百度统计

### 获取站点 ID
1. 登录 [百度统计](https://tongji.baidu.com/)
2. 添加网站，获取 **站点 ID**（格式：\`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\`）

### 配置方式

\`\`\`html
<script>
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();
</script>
\`\`\`

### 事件追踪

\`\`\`javascript
// 浏览事件（自动由百度统计代码处理）

// 自定义事件
_hmt.push(['_trackEvent', '表单', '提交', '留资表单', 1]);

// 页面浏览（SPA 场景手动上报）
_hmt.push(['_trackPageview', '/custom-page']);
\`\`\`

### 注意事项
- 百度统计在中国大陆访问速度快于 GA4
- 建议中国大陆站点同时使用百度统计 + GA4
- 百度统计不支持跨域追踪

---

## 3. Facebook Pixel

### 获取 Pixel ID
1. 登录 [Facebook Events Manager](https://www.facebook.com/events_manager/)
2. 创建 Pixel，复制 **Pixel ID**（格式：数字，如 \`1234567890\`）

### 配置方式

\`\`\`html
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1234567890');
fbq('track', 'PageView');
</script>
<noscript>
<img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=1234567890&ev=PageView&noscript=1"/>
</noscript>
\`\`\`

### 标准事件

\`\`\`javascript
// 页面浏览（已自动追踪）

// 线索（留资）
fbq('track', 'Lead', {
  value: 0.00,
  currency: 'CNY'
});

// 注册完成
fbq('track', 'CompleteRegistration', {
  content_name: '用户注册',
  status: true
});

// 加入购物车
fbq('track', 'AddToCart', {
  content_ids: ['SKU_001'],
  content_type: 'product',
  value: 99.00,
  currency: 'CNY'
});

// 购买
fbq('track', 'Purchase', {
  content_ids: ['SKU_001'],
  content_type: 'product',
  value: 99.00,
  currency: 'CNY',
  num_items: 1
});
\`\`\`

### 自定义事件

\`\`\`javascript
// 自定义事件
fbq('trackCustom', 'CTAClick', {
  button_name: 'get_started',
  section: 'hero'
});
\`\`\`

---

## 4. 在 Luban 中的集成方式

### 方式一：站点全局 Head 注入
在站点配置的 **自定义 Head** 中添加分析脚本，所有页面自动加载。

### 方式二：事件绑定节点
使用 Luban 的事件系统，在按钮/表单的 \`events\` 配置中添加分析调用：

\`\`\`json
{
  "events": {
    "click": {
      "action": "trackEvent",
      "payload": {
        "provider": "ga4",
        "eventName": "button_click",
        "params": {
          "button_name": "cta_download"
        }
      }
    }
  }
}
\`\`\`

### 方式三：SSR 环境注意事项
- Luban 站点基于 SSR（服务端渲染），分析代码需确保在客户端执行
- 使用 \`typeof window !== 'undefined'\` 判断客户端环境
- 避免在服务端调用 \`document\` / \`window\` 等浏览器 API
- gtag / \`_hmt\` / fbq 初始化脚本必须放在客户端执行

---

## 5. 多平台并行推荐

| 目标市场 | 推荐配置 | 说明 |
|---------|---------|------|
| 中国大陆 | 百度统计 + GA4 | 百度统计满足合规要求，GA4 做深度分析 |
| 海外 | GA4 + Facebook Pixel | GA4 做流量分析，Pixel 做广告转化 |
| 全球 | 三者全加 | 覆盖所有渠道，注意页面加载性能 |

> **性能建议**：同时加载多个分析脚本会影响页面性能。建议使用 TMS（如 Google 标签管理器）统一管理，按需加载。
`,
};
