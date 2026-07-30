# 组件总览

Luban 内置 **75+ Material Design 组件**，涵盖 8 大分类。所有组件通过 `materialRegistry` 自动注册，在引擎物料面板可直接拖拽使用。

## 按钮预览

<div style="display:flex;gap:12px;flex-wrap:wrap;padding:24px;border:1px solid var(--vp-c-divider);border-radius:12px;margin:24px 0">
  <button style="padding:8px 20px;border-radius:8px;border:none;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;cursor:pointer">主要按钮</button>
  <button style="padding:8px 20px;border-radius:8px;border:none;background:#9c27b0;color:#fff;font-size:14px;font-weight:600;cursor:pointer">次要按钮</button>
  <button style="padding:8px 20px;border-radius:8px;border:1.5px solid #e2e8f0;background:transparent;color:#1e293b;font-size:14px;font-weight:600;cursor:pointer">描边按钮</button>
  <button style="padding:8px 20px;border-radius:8px;border:none;background:transparent;color:#4f46e5;font-size:14px;font-weight:600;cursor:pointer">文本按钮</button>
</div>

## 提示组件预览

<div style="display:flex;flex-direction:column;gap:12px;margin:24px 0">
  <div style="padding:12px 16px;border-radius:8px;background:#eef2ff;border:1px solid #c7d2fe;color:#4f46e5;font-size:14px">ℹ 这是一条信息提示</div>
  <div style="padding:12px 16px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;font-size:14px">✓ 操作成功！</div>
  <div style="padding:12px 16px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;color:#d97706;font-size:14px">⚠ 请注意此操作</div>
  <div style="padding:12px 16px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:14px">✕ 发生错误</div>
</div>

## 步骤流程预览

<div style="display:flex;gap:0;padding:24px;border:1px solid var(--vp-c-divider);border-radius:12px;margin:24px 0">
  <div style="flex:1;text-align:center;position:relative">
    <div style="width:40px;height:40px;border-radius:50%;background:#4f46e5;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:8px">1</div>
    <div style="font-weight:600;font-size:15px">拖拽组件</div>
    <div style="font-size:13px;color:#64748b">从面板拖入画布</div>
  </div>
  <div style="flex:1;text-align:center">
    <div style="width:40px;height:40px;border-radius:50%;background:#e2e8f0;color:#64748b;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:8px">2</div>
    <div style="font-weight:600;font-size:15px">配置属性</div>
    <div style="font-size:13px;color:#64748b">右侧面板设置</div>
  </div>
  <div style="flex:1;text-align:center">
    <div style="width:40px;height:40px;border-radius:50%;background:#e2e8f0;color:#64748b;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:8px">3</div>
    <div style="font-weight:600;font-size:15px">发布上线</div>
    <div style="font-size:13px;color:#64748b">一键 SSR 部署</div>
  </div>
</div>

::: tip 💡 完整交互预览
启动 Storybook 查看所有 75+ 组件的实时交互演示：
```bash
cd packages/ui && pnpm exec storybook dev -p 6006
```
:::

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
