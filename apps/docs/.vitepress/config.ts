import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: 'Luban',
  description: '开源低代码平台文档',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/luban-logo.svg' }]
  ],

  // Vite 配置：alias luban-base/luban-low-code 用于文档内组件实时预览
  vite: {
    resolve: {
      alias: {
        'luban-base': fileURLToPath(
          new URL('../../../packages/ui/packages/luban-base/dist/index.js', import.meta.url),
        ),
        'luban-low-code': fileURLToPath(
          new URL('../../../packages/ui/packages/luban-low-code/dist/index.js', import.meta.url),
        ),
      },
    },
    css: {
      preprocessorOptions: {
        scss: { additionalData: `@use "../../../../packages/ui/packages/luban-base/src/styles/_variables.scss" as *;` }
      }
    },
  },

  // 全局 CSS：luban 组件样式在 theme/index.ts 中导入

  themeConfig: {
    siteTitle: 'Luban',
    logo: '/luban-logo.svg',
    darkModeSwitchingLabel: '切换主题',

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    outline: {
      label: '本页目录',
      level: 'deep'
    },
    lastUpdated: {
      text: '最后更新于'
    },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',

    // 本地搜索
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    // 顶部导航栏
    nav: [
      { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'API', link: '/api/public', activeMatch: '/api/' },
      { text: '组件', link: '/components/overview', activeMatch: '/components/' }
    ],

    // 侧边栏：按章节分组（多级目录树）
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          collapsed: false,
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '系统架构', link: '/guide/architecture' },
            { text: '部署指南', link: '/guide/deployment' },
            { text: '贡献指南', link: '/guide/contributing' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API 参考',
          collapsed: false,
          items: [
            { text: '公开接口', link: '/api/public' },
            { text: '管理接口', link: '/api/admin' },
            { text: '错误码', link: '/api/errors' }
          ]
        }
      ],
      '/components/': [
        {
          text: '组件文档',
          collapsed: false,
          items: [
            { text: '组件总览', link: '/components/overview' },
            {
              text: '布局组件',
              collapsed: false,
              items: [
                { text: 'Container', link: '/components/layout' },
                { text: 'Grid', link: '/components/layout' },
                { text: 'Section', link: '/components/layout' }
              ]
            },
            {
              text: '表单组件',
              collapsed: false,
              items: [
                { text: 'Form', link: '/components/form' },
                { text: 'Input', link: '/components/form' },
                { text: 'Select', link: '/components/form' }
              ]
            },
            {
              text: '营销组件',
              collapsed: false,
              items: [
                { text: 'Hero', link: '/components/marketing' },
                { text: 'CTA', link: '/components/marketing' },
                { text: 'Feature', link: '/components/marketing' }
              ]
            }
          ]
        }
      ]
    },

    // 社交链接：GitHub
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xiaoshuai1024/luban-low-code' }
    ],

    // 页脚
    footer: {
      message: '基于 MIT 协议开源发布',
      copyright: 'Copyright © 2026 Luban'
    }
  }
})
