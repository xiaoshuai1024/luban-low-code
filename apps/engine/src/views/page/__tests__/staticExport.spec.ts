/**
 * staticExport.spec.ts — V2-T9 出码单测。
 *
 * 验证 schemaToHtml 纯函数：
 *  - 基础结构：DOCTYPE/html/head/body
 *  - 物料类型转语义 HTML（Hero/CTA/FeatureGrid/Text/Container）
 *  - 内联 CSS（base + responsive @media + animation @keyframes）
 *  - SEO meta 注入（title/description/og/robots noindex/canonical）
 *  - HTML 转义（防 XSS）
 *  - 未知组件占位
 */
import { describe, it, expect } from 'vitest'
import { schemaToHtml, buildExportPackage } from '@/utils/staticExport'
import type { PageSchema } from '@/types/schema'

describe('V2-T9 schemaToHtml', () => {
  it('输出合法 HTML 骨架', () => {
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    const html = schemaToHtml(schema, { title: '测试页' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('<title>测试页</title>')
    expect(html).toContain('viewport')
  })

  it('LubanText 转 <p>', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          { id: 't1', type: 'LubanText', props: { content: '你好世界' } },
        ],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('<p')
    expect(html).toContain('你好世界')
  })

  it('LubanHero 转 hero section', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          {
            id: 'h1',
            type: 'LubanHero',
            props: { title: '欢迎', subtitle: '副标题', ctaText: '开始', buttonUrl: '#start' },
          },
        ],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('<h1>欢迎</h1>')
    expect(html).toContain('class="hero-sub"')
    expect(html).toContain('class="hero-cta"')
    expect(html).toContain('href="#start"')
  })

  it('LubanFeatureGrid 转 feature 卡片', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          {
            id: 'fg1',
            type: 'LubanFeatureGrid',
            props: {
              features: [
                { icon: '⚡', title: '快', description: '高性能' },
                { icon: '🔒', title: '安全', description: '加密' },
              ],
            },
          },
        ],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('⚡')
    expect(html).toContain('class="feature"')
    expect(html).toContain('快')
    expect(html).toContain('安全')
  })

  it('响应式 @media CSS 内联', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          {
            id: 'n1',
            type: 'LubanText',
            style: { fontSize: '16px' },
            responsive: { mobile: { fontSize: '12px' } },
          },
        ],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('@media')
    expect(html).toContain('[data-lb-node="n1"]')
    expect(html).toContain('font-size: 12px')
  })

  it('动画 @keyframes CSS 内联', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          {
            id: 'a1',
            type: 'LubanText',
            animation: { type: 'fade', trigger: 'load' },
          },
        ],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('@keyframes lb-anim-fade')
  })

  it('SEO meta 注入', () => {
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
      seo: {
        title: 'SEO 标题',
        description: '页面描述',
        keywords: ['营销', '建站'],
        ogTitle: 'OG 标题',
        ogImage: 'https://img.test/cover.png',
        noIndex: true,
        canonical: 'https://test.com/page',
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('name="description" content="页面描述"')
    expect(html).toContain('name="keywords" content="营销, 建站"')
    expect(html).toContain('property="og:title" content="OG 标题"')
    expect(html).toContain('property="og:image" content="https://img.test/cover.png"')
    expect(html).toContain('name="robots" content="noindex, nofollow"')
    expect(html).toContain('rel="canonical" href="https://test.com/page"')
  })

  it('HTML 转义防 XSS', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          {
            id: 't1',
            type: 'LubanText',
            props: { content: '<script>alert(1)</script>' },
          },
        ],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('未知组件占位（data-type）', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [{ id: 'u1', type: 'LubanUnknownWidget', props: {} }],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('class="lb-unknown"')
    expect(html).toContain('data-type="LubanUnknownWidget"')
  })

  it('节点内联 style 输出', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        style: { backgroundColor: '#f0f0f0', marginTop: '20px' },
        children: [],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('background-color:#f0f0f0')
    expect(html).toContain('margin-top:20px')
  })

  it('留资表单生成原生 form', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          {
            id: 'lf1',
            type: 'LubanLeadCapture',
            props: {
              heading: '联系我们',
              showName: true,
              showPhone: true,
              showEmail: true,
              submitText: '提交',
            },
          },
        ],
      },
    }
    const html = schemaToHtml(schema)
    expect(html).toContain('<form')
    expect(html).toContain('type="tel"')
    expect(html).toContain('type="email"')
    expect(html).toContain('type="submit"')
  })
})

describe('V2-T9 buildExportPackage (多文件)', () => {
  it('生成 4 个文件（index.html + style.css + app.js + README）', () => {
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    const files = buildExportPackage(schema, { title: '测试' })
    expect(files.length).toBe(4)
    expect(files.map((f) => f.path)).toEqual([
      'index.html',
      'assets/style.css',
      'assets/app.js',
      'README.md',
    ])
  })

  it('index.html 引用 assets/style.css 而非内联', () => {
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    const files = buildExportPackage(schema)
    const index = files.find((f) => f.path === 'index.html')!
    expect(index.content).toContain('<link rel="stylesheet" href="assets/style.css">')
    expect(index.content).toContain('<script src="assets/app.js">')
  })

  it('style.css 含响应式 + 动画 CSS', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          {
            id: 'n1',
            type: 'LubanText',
            style: { fontSize: '16px' },
            responsive: { mobile: { fontSize: '12px' } },
            animation: { type: 'fade', trigger: 'load' },
          },
        ],
      },
    }
    const files = buildExportPackage(schema)
    const css = files.find((f) => f.path === 'assets/style.css')!
    expect(css.content).toContain('@media')
    expect(css.content).toContain('@keyframes lb-anim-fade')
  })

  it('app.js 含留资表单提交逻辑', () => {
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    const files = buildExportPackage(schema)
    const js = files.find((f) => f.path === 'assets/app.js')!
    expect(js.content).toContain('lb-lead')
    expect(js.content).toContain('fetch')
  })

  it('README 含部署说明', () => {
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    const files = buildExportPackage(schema, { title: '我的站点' })
    const readme = files.find((f) => f.path === 'README.md')!
    expect(readme.content).toContain('我的站点')
    expect(readme.content).toContain('部署')
  })
})
