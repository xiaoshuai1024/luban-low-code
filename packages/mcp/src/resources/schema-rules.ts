/**
 * Schema Rules — Luban 低代码页面 Schema 结构说明。
 *
 * Resource URI: luban://schema/rules
 * MIME: text/markdown
 *
 * @since 0.1.0
 */

import type { ResourceDef } from './lib/resource-registry.js';

export const schemaRulesResource: ResourceDef = {
  uri: 'luban://schema/rules',
  name: '页面 Schema 结构说明',
  description: 'Luban 低代码页面 Schema 结构说明',
  mimeType: 'text/markdown',
  load: () => `# Luban 低代码页面 Schema 结构说明

## 整体结构

\`\`\`typescript
interface PageSchema {
  version: string;           // Schema 版本号，当前为 "1.0"
  metadata: {                // 页面元数据
    title: string;           // 页面标题
    description?: string;    // 页面描述
    slug?: string;           // 路径 slug
    locale?: string;         // 语言，默认 "zh-CN"
    published?: boolean;     // 是否发布
    tags?: string[];         // 标签
  };
  root: NodeSchema;          // 根节点（必须是 LubanContainer）
  seo?: {                    // SEO 配置
    title?: string;          // SEO 标题
    description?: string;    // SEO 描述
    ogImage?: string;        // Open Graph 图片
    noIndex?: boolean;       // 是否禁止搜索引擎索引
  };
}
\`\`\`

## NodeSchema（节点结构）

\`\`\`typescript
interface NodeSchema {
  id: string;                        // 节点唯一标识
  type: string;                      // 物料类型名称
  props?: Record<string, unknown>;   // 物料特定属性
  children?: NodeSchema[];           // 子节点
  events?: {                         // 事件绑定
    [eventName: string]: {
      action: string;                // 动作类型
      payload?: Record<string, unknown>; // 动作参数
    };
  };
}
\`\`\`

## type（物料类型）

type 字段对应物料注册名称，常见物料类型：

| type | 分类 | 说明 |
|------|------|------|
| LubanContainer | layout | 通用容器，根节点必需 |
| LubanRow | layout | flex 行/列容器 |
| LubanCol | layout | 栅格列 |
| LubanSidePanel | layout | 侧边面板 |
| LubanHero | marketing | Hero 区块 |
| LubanNavbar | marketing | 导航栏 |
| LubanFooter | marketing | 页脚 |
| LubanFeatureGrid | marketing | 特性网格 |
| LubanStats | marketing | 统计数据 |
| LubanFAQ | marketing | 常见问题 |
| LubanPricing | marketing | 定价方案 |
| LubanTestimonial | marketing | 用户证言 |
| LubanTestimonialCarousel | marketing | 证言轮播 |
| LubanGallery | marketing | 图片画廊 |
| LubanLogoCloud | marketing | Logo 云 |
| LubanCTA | marketing | 行动号召 |
| LubanLeadCapture | marketing | 留资表单 |
| LubanForm | form | 表单容器 |
| LubanInput | form | 文本框 |
| LubanTextArea | form | 多行文本 |
| LubanSelect | form | 下拉选择 |
| LubanCheckbox | form | 复选框 |
| LubanRadioGroup | form | 单选框组 |
| LubanSwitch | form | 开关 |
| LubanButton | general | 按钮 |
| LubanText | general | 通用文本 |
| LubanBanner | content | 横幅 |
| LubanContentList | content | 内容列表 |
| LubanMarkdown | content | Markdown 渲染 |
| LubanSteps | content | 步骤条 |
| LubanCodeBlock | data-display | 代码块 |
| LubanTable | data-display | 表格 |
| LubanMenu | navigation | 菜单 |
| LubanTabs | navigation | 标签页 |
| LubanBackToTop | navigation | 回到顶部 |
| LubanModal | feedback | 模态框 |
| LubanDrawer | feedback | 抽屉 |
| LubanToast | feedback | 轻提示 |
| LubanAlert | feedback | 警告提示 |

## props（物料属性）

props 是每个物料特定的属性，遵循 JSON Schema 格式定义。通用属性包括：

- \`key\`: string — 组件 key
- \`style\`: Record<string, string> — 行内样式
- \`className\`: string — CSS 类名

## 团队规范

1. **页面根节点必须是 LubanContainer**，不允许以其他类型作为根节点。
2. LubanContainer 的 \`maxWidth\` 属性控制页面最大宽度：\`sm\`(640px) / \`md\`(768px) / \`lg\`(1024px) / \`full\`(100%)。
3. 表单控件物料（LubanInput / LubanTextArea / LubanSelect 等）只能放置在 LubanForm 或 LubanLeadCapture 内。
4. 物料 props 中的 \`label\` 字段用于表单字段标签，\`placeholder\` 用于占位提示，需为可访问性提供支持。
5. 事件绑定目前支持 \`click\`、\`submit\`、\`change\` 等标准 DOM 事件。
6. 每个节点必须有唯一的 \`id\`，建议使用 UUID v4 或语义化标识（如 \`hero-section\`）。
`,
};
