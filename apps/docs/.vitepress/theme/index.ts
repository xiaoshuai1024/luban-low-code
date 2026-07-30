import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'

// 导入 luban 组件样式
import '../../../../packages/ui/packages/luban-base/dist/index.css'
import '../../../../packages/ui/packages/luban-low-code/dist/index.css'

// 导入组件预览容器
import ComponentPreview from './ComponentPreview.vue'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // 可扩展布局插槽
    })
  },
  enhanceApp({ app }) {
    // 注册全局组件：文档中可直接 <ComponentPreview> 使用
    app.component('ComponentPreview', ComponentPreview)
  },
} satisfies Theme
