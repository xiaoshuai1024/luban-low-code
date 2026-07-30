# 营销组件

营销建站组件，用于官网、落地页、产品展示页。

## Hero

页面首屏区域，含标题、副标题、CTA 按钮。

```json
{
  "type": "LubanHero",
  "props": {
    "title": "产品标题",
    "subtitle": "产品描述文字",
    "eyebrow": "新版本上线",
    "ctaText": "立即体验",
    "ctaUrl": "/signup",
    "layout": "centered",
    "height": "400px"
  }
}
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | - | 主标题 |
| subtitle | string | - | 副标题 |
| eyebrow | string | - | 眉标（标题上方小标签） |
| ctaText | string | 了解更多 | 主按钮文字 |
| ctaUrl | string | - | 主按钮链接 |
| secondaryCtaText | string | - | 次按钮文字 |
| secondaryCtaUrl | string | - | 次按钮链接 |
| layout | `centered \| split` | centered | 布局变体 |
| backgroundImage | string | - | 背景图 URL |

## CTA

行动号召横幅，渐变背景 + 按钮。

```json
{
  "type": "LubanCTA",
  "props": {
    "heading": "准备好开始了吗？",
    "description": "立即免费试用",
    "buttonText": "开始使用",
    "buttonUrl": "/signup"
  }
}
```

## FeatureGrid

功能特性网格，多列卡片排列。

```json
{
  "type": "LubanFeatureGrid",
  "props": {
    "heading": "核心特性",
    "columns": 3,
    "features": [
      { "icon": "🎨", "title": "可视化", "description": "拖拽搭建" },
      { "icon": "⚡", "title": "高性能", "description": "SSR 渲染" }
    ]
  }
}
```

## Stats

数据统计区域，展示 KPI 数字。

```json
{
  "type": "LubanStats",
  "props": {
    "stats": [
      { "value": "75+", "label": "组件" },
      { "value": "10k+", "label": "用户" }
    ]
  }
}
```

## Pricing

定价方案卡片对比。

```json
{
  "type": "LubanPricing",
  "props": {
    "plans": [
      { "name": "免费版", "price": "0", "features": ["3个站点", "基础组件"] },
      { "name": "专业版", "price": "99", "features": ["无限站点", "全部组件"], "highlighted": true }
    ]
  }
}
```

## 其他营销组件

| 组件 | 说明 |
|------|------|
| Navbar | 顶部导航栏，sticky + blur |
| Footer | 页脚，多列链接 + 版权 |
| FAQ | 常见问题手风琴 |
| Testimonial | 用户评价卡片 |
| TestimonialCarousel | 评价轮播 |
| Gallery | 图片画廊网格 |
| LogoCloud | 客户 Logo 展示条 |
| LeadCapture | 线索采集区块 |
| Countdown | 倒计时 |
