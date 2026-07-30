# 组件总览

Luban 内置 **75+ Material Design 组件**，涵盖 8 大分类。所有组件通过 `materialRegistry` 自动注册，在引擎物料面板可直接拖拽使用。

## 分类一览

| 分类 | 组件数 | 部分组件 |
|------|:---:|----------|
| **Layout** | 5 | Container, Row, Col, SidePanel, Divider |
| **Form** | 8 | Input, Select, TextArea, Checkbox, Switch, RadioGroup, Form, TagInput |
| **Marketing** | 14 | Hero, CTA, FeatureGrid, Pricing, FAQ, Stats, Testimonial, TestimonialCarousel, Gallery, Navbar, Footer, LogoCloud, LeadCapture, Countdown |
| **Data Display** | 2 | Table, CodeBlock |
| **Navigation** | 4 | Tabs, Menu, BackToTop, Steps |
| **Feedback** | 4 | Alert, Modal, Drawer, Toast |
| **Content** | 4 | Banner, ContentList, Markdown, Steps |
| **General** | 7 | Button, Text, Heading, Link, Icon, Image, Card |

## 组件 Schema 结构

每个组件在 schema 中的表示：

```json
{
  "id": "unique-node-id",
  "type": "LubanButton",
  "props": {
    "content": "Click Me",
    "color": "primary"
  },
  "children": []
}
```

## 组件开发

新增组件步骤：

1. 在 `packages/ui/packages/luban-low-code/src/materials/<category>/<name>/` 创建目录
2. 创建 `Component.vue` — Vue 3 SFC + scoped SCSS
3. 创建 `material.ts` — defineMaterial + propsSchema
4. 在 `materials/index.ts` 注册（import + 加到数组）
5. 编写 vitest 单元测试
6. 添加 Storybook story

详见 [贡献指南](/guide/contributing)。
