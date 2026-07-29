/**
 * Best Practices — 页面创建最佳实践。
 *
 * Resource URI: luban://best-practices/page-creation
 * MIME: text/markdown
 *
 * @since 0.1.0
 */

import type { ResourceDef } from './lib/resource-registry.js';

export const bestPracticesResource: ResourceDef = {
  uri: 'luban://best-practices/page-creation',
  name: '页面创建最佳实践',
  description: 'Luban 低代码页面创建的最佳实践指南。',
  mimeType: 'text/markdown',
  load: () => `# Luban 页面创建最佳实践

## 1. 布局规范

### 根节点
- **页面根节点必须是 LubanContainer**，不允许以其他类型作为根节点。
- LubanContainer 的 \`maxWidth\` 控制页面最大宽度：
  - \`sm\` — 640px，适合窄内容页（如文章、隐私协议）
  - \`md\` — 768px，适合中等宽度页面（如留资页）
  - \`lg\` — 1024px，适合标准页面（如企业介绍）
  - \`full\` — 100%，适合全宽页面（如电商首页、推广页）

### 栅格布局
- 使用 **LubanRow + LubanCol** 实现栅格布局。
- LubanRow 的 \`gap\` 属性控制子节点间距。
- LubanCol 的 \`span\` 属性基于 24 列栅格系统（如 span=8 表示占 1/3 宽度）。
- \`offset\` 属性可实现列偏移，用于居中或不对称布局。

### 嵌套规则
- 表单控件（LubanInput / LubanTextArea / LubanSelect / LubanCheckbox / LubanRadioGroup / LubanSwitch）**只能放置在 LubanForm 或 LubanLeadCapture 内**。
- LubanRow 的子节点应为 LubanCol。
- LubanContainer 可无限嵌套，用于构建复杂布局。

## 2. SEO 优化

- 在 PageSchema 的 \`seo\` 字段中设置：
  - \`seo.title\` — 页面标题（建议 30-60 字符）
  - \`seo.description\` — 页面描述（建议 50-160 字符）
  - \`seo.ogImage\` — Open Graph 分享图片 URL（建议 1200×630px）
  - \`seo.noIndex\` — 对隐私协议、维护中等页面设为 \`true\`
- 使用 LubanText 的 \`tag\` 属性设置正确的标题层级（h1/h2/h3），确保页面只有一个 h1。
- 为图片物料（LubanHero 的 backgroundImage、LubanBanner 的 image）提供有意义的 alt 文本。

## 3. 响应式设计

- 使用 LubanContainer 的 \`maxWidth\` 控制整体布局宽度，移动端自动适配。
- LubanRow 默认 \`wrap: true\`，子节点在空间不足时会自动换行。
- LubanFeatureGrid 和 LubanGallery 的 \`columns\` 属性在移动端会自动降为 1 列。
- LubanNavbar 的导航链接在移动端自动折叠为汉堡菜单。
- 避免在 props 中使用固定 px 值，优先使用 CSS 变量（\`var(--lb-*)\`）。

## 4. 表单最佳实践

- 为每个表单控件设置 \`label\` 属性，提供可访问性支持。
- 使用 \`placeholder\` 提供输入提示，帮助用户理解预期值。
- 必填字段设置 \`required: true\`，表单提交时自动校验。
- LubanForm 的 \`submit\` 事件绑定用于处理表单提交逻辑。
- LubanLeadCapture 预设了常见线索收集字段（姓名、邮箱、电话），按需启用。
- LubanInput 的 \`type\` 属性根据数据类型设置（email / tel / number 等），移动端会自动弹出对应键盘。

## 5. 性能优化

- 减少页面根节点的直接子节点数量，使用 LubanContainer/LubanRow 分组。
- Hero 区块使用 \`backgroundColor\` 配合 \`backgroundImage\`，避免图片加载前的白屏。
- 避免过深的节点嵌套（建议不超过 5 层）。
- Gallery 和 LogoCloud 的图片建议使用 CDN 链接并按需调整尺寸。

## 6. 事件与交互

- 使用 \`events\` 字段绑定交互事件：
  - \`click\` — 点击事件（按钮、卡片等）
  - \`submit\` — 表单提交事件
  - \`change\` — 值变更事件（Select、Switch 等）
- 事件动作类型目前支持：\`navigate\`（页面跳转）、\`submitForm\`（提交表单）、\`showModal\`（显示模态框）、\`showToast\`（显示提示）。

## 7. 样式与主题

- 使用物料预设的 \`variant\` / \`size\` 属性，避免自定义 CSS。
- 如需自定义颜色，使用 CSS 变量体系：\`--lb-primary\`、\`--lb-secondary\`、\`--lb-bg-dark\` 等。
- LubanText 的 \`variant\` 提供标准排版比例，保持全站一致性。
- 按钮的 \`variant\` 类型：\`primary\`（主色调）、\`secondary\`（次色调）、\`outline\`（描边）、\`ghost\`（幽灵）、\`danger\`（危险）。

## 8. 模板选择

- **空白页** — 从零开始，完全自定义。
- **SaaS 产品落地页** — 适合产品官网首页（Hero + 特性 + 定价 + CTA）。
- **企业介绍页** — 公司介绍 + 客户证言。
- **电商首页/促销页** — 商品展示 + 转化引导。
- **活动报名页** — 限时活动注册。
- **留资落地页** — 线索收集，高转化设计。
- **个人作品集** — 个人品牌展示。
- **App 下载页** — 移动应用推广。
`,
};
