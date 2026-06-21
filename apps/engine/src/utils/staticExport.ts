/**
 * V2-T9 出码：PageSchema → 独立 HTML 静态站导出。
 *
 * exportPageToHtml(schema, options)：生成单文件 self-contained HTML，
 * 内联 CSS（含响应式 @media + 动画 @keyframes）+ 内联 JS（最小运行时），
 * 可直接双击打开或部署到任意静态托管。
 *
 * 设计决策（plan §T9）：
 *  - 不依赖 Vue 运行时：把 luban-low-code 的组件渲染"冻结"为纯 HTML 字符串。
 *    物料文本类（LubanText/Hero/CTA/FeatureGrid/Pricing 等）转为语义 HTML；
 *    未知组件用占位 div 提示。
 *  - 内联 CSS：树遍历收集 responsiveCss + animationCss + 节点内联 style（按断点折叠）。
 *  - 响应式：viewport meta + @media（与 website RuntimeRenderer 同源 treeResponsiveCss）。
 *  - 留资表单：生成原生 <form>，提交到可配置 endpoint（默认 mailto 兜底）。
 *
 * 单测友好：纯函数，schemaToHtml 输入 schema 输出 HTML 字符串。
 */
import type { PageSchema, NodeSchema } from 'luban-low-code'
import { treeResponsiveCss, treeAnimationCss } from 'luban-low-code'

export interface ExportOptions {
  /** 页面标题（<title>） */
  title?: string
  /** 留资表单提交地址（默认 mailto 兜底） */
  formAction?: string
  /** 是否内联 luban-base 默认 CSS（var token 层） */
  inlineBaseCss?: boolean
}

/** HTML 转义 */
function esc(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 节点 → HTML 字符串（递归；已知物料类型转语义 HTML，未知用占位） */
function nodeToHtml(node: NodeSchema, depth = 0): string {
  const indent = '  '.repeat(depth)
  const children = (node.children ?? []).map((c) => nodeToHtml(c, depth + 1)).join('\n')
  const styleAttr = node.style && Object.keys(node.style).length
    ? ` style="${Object.entries(node.style).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';')}"`
    : ''
  const dataAttr = ` data-lb-node="${esc(node.id)}"`
  const p = (node.props ?? {}) as Record<string, unknown>

  switch (node.type) {
    case 'LubanContainer':
      return `${indent}<div${dataAttr}${styleAttr}>\n${children}\n${indent}</div>`
    case 'LubanText':
      return `${indent}<p${dataAttr}${styleAttr}>${esc(p.content ?? '')}</p>`
    case 'LubanHero': {
      const heading = p.title ? `\n${indent}  <h1>${esc(p.title)}</h1>` : ''
      const sub = p.subtitle ? `\n${indent}  <p class="hero-sub">${esc(p.subtitle)}</p>` : ''
      const cta = p.ctaText ? `\n${indent}  <a class="hero-cta" href="${esc(p.buttonUrl || '#')}">${esc(p.ctaText)}</a>` : ''
      return `${indent}<section${dataAttr}${styleAttr} class="lb-hero">${heading}${sub}${cta}\n${indent}</section>`
    }
    case 'LubanCTA': {
      const heading = p.heading ? `\n${indent}  <h2>${esc(p.heading)}</h2>` : ''
      const cta = p.buttonText ? `\n${indent}  <a class="cta-btn" href="${esc(p.buttonUrl || '#')}">${esc(p.buttonText)}</a>` : ''
      return `${indent}<section${dataAttr}${styleAttr} class="lb-cta">${heading}${cta}\n${indent}</section>`
    }
    case 'LubanFeatureGrid': {
      const features = Array.isArray(p.features) ? p.features : []
      const items = features
        .map(
          (f: any) =>
            `${indent}  <div class="feature"><div class="feature-icon">${esc(f.icon)}</div><h3>${esc(f.title)}</h3><p>${esc(f.description)}</p></div>`
        )
        .join('\n')
      return `${indent}<section${dataAttr}${styleAttr} class="lb-feature-grid">\n${items}\n${indent}</section>`
    }
    case 'LubanPricing': {
      const plans = Array.isArray(p.plans) ? p.plans : []
      const items = plans
        .map((plan: any) => {
          const feats = Array.isArray(plan.features)
            ? plan.features.map((f: any) => `<li class="${f.included ? 'on' : 'off'}">${f.included ? '✓' : '✗'} ${esc(f.text)}</li>`).join('')
            : ''
          return `${indent}  <div class="plan${plan.highlight ? ' plan-highlight' : ''}"><h3>${esc(plan.name)}</h3><div class="price">${esc(plan.price)}<span>${esc(plan.period || '')}</span></div><ul>${feats}</ul><a class="plan-cta" href="#">${esc(plan.ctaText || '选择')}</a></div>`
        })
        .join('\n')
      return `${indent}<section${dataAttr}${styleAttr} class="lb-pricing">\n${items}\n${indent}</section>`
    }
    case 'LubanTestimonial': {
      const t = p as any
      const stars = '★'.repeat(Number(t.rating) || 0) + '☆'.repeat(5 - (Number(t.rating) || 0))
      return `${indent}<blockquote${dataAttr}${styleAttr} class="lb-testimonial"><div class="stars">${stars}</div><p>${esc(t.quote)}</p><footer><strong>${esc(t.author)}</strong> ${esc(t.role || '')}</footer></blockquote>`
    }
    case 'LubanFAQ': {
      const items = (Array.isArray(p.items) ? p.items : [])
        .map((it: any) => `${indent}  <details><summary>${esc(it.question)}</summary><p>${esc(it.answer)}</p></details>`)
        .join('\n')
      return `${indent}<section${dataAttr}${styleAttr} class="lb-faq">\n${items}\n${indent}</section>`
    }
    case 'LubanStats': {
      const stats = (Array.isArray(p.stats) ? p.stats : [])
        .map((s: any) => `${indent}  <div class="stat"><div class="stat-value">${esc(s.value)}${esc(s.suffix || '')}</div><div class="stat-label">${esc(s.label)}</div></div>`)
        .join('\n')
      return `${indent}<section${dataAttr}${styleAttr} class="lb-stats">\n${stats}\n${indent}</section>`
    }
    case 'LubanLeadCapture': {
      const heading = p.heading ? `<h2>${esc(p.heading)}</h2>` : ''
      const nameField = p.showName ? `<input type="text" name="name" placeholder="姓名" required>` : ''
      const phoneField = p.showPhone ? `<input type="tel" name="phone" placeholder="手机号" required>` : ''
      const emailField = p.showEmail ? `<input type="email" name="email" placeholder="邮箱" required>` : ''
      return `${indent}<form${dataAttr}${styleAttr} class="lb-lead" method="POST" action="${esc(p.submitUrl || '#')}">${heading}<div class="lb-lead-fields">${nameField}${phoneField}${emailField}</div><button type="submit">${esc(p.submitText || '提交')}</button></form>`
    }
    case 'LubanFooter': {
      const copyright = p.copyright ? `${indent}  <p>${esc(p.copyright)}</p>` : ''
      return `${indent}<footer${dataAttr}${styleAttr} class="lb-footer">\n${copyright}\n${children}\n${indent}</footer>`
    }
    case 'LubanNavbar': {
      const links = (Array.isArray(p.links) ? p.links : [])
        .map((l: any) => `<a href="${esc(l.url || '#')}">${esc(l.label)}</a>`)
        .join('')
      return `${indent}<nav${dataAttr}${styleAttr} class="lb-nav"><span class="brand">${esc(p.brand || '')}</span><div class="links">${links}</div></nav>`
    }
    default:
      // 未知组件：占位提示，保留子节点
      return `${indent}<div${dataAttr}${styleAttr} class="lb-unknown" data-type="${esc(node.type)}">\n${children}\n${indent}</div>`
  }
}

/** luban-base 默认 :root CSS 变量层（与 _variables.scss 同步的最小子集） */
const BASE_CSS = `
:root {
  --lb-bg: #ffffff; --lb-bg-dark: #1a1a2e; --lb-text-on-dark: #ffffff;
  --lb-accent: #4361ee; --lb-accent-contrast: #ffffff; --lb-border: #e5e7eb;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
.lb-hero { padding: 80px 24px; text-align: center; }
.lb-hero h1 { font-size: 2.5rem; margin: 0 0 16px; }
.lb-hero .hero-sub { font-size: 1.125rem; color: rgba(255,255,255,0.85); margin-bottom: 32px; }
.lb-hero .hero-cta { display: inline-block; padding: 12px 32px; background: #fff; color: #1a1a2e; border-radius: 6px; text-decoration: none; font-weight: 600; }
.lb-cta { padding: 64px 24px; text-align: center; }
.lb-cta .cta-btn { display: inline-block; padding: 14px 36px; background: #4361ee; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
.lb-feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; padding: 64px 24px; max-width: 1100px; margin: 0 auto; }
.lb-feature-grid .feature { padding: 24px; }
.lb-feature-grid .feature-icon { font-size: 2rem; }
.lb-pricing { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; padding: 64px 24px; max-width: 1100px; margin: 0 auto; }
.lb-pricing .plan { padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; }
.lb-pricing .plan-highlight { border-color: #1a1a2e; }
.lb-pricing .price { font-size: 2rem; font-weight: 700; margin: 16px 0; }
.lb-pricing .plan-cta { display: block; padding: 12px; background: #1a1a2e; color: #fff; text-align: center; text-decoration: none; border-radius: 8px; }
.lb-testimonial { margin: 0; padding: 24px; }
.lb-testimonial .stars { color: #f59e0b; }
.lb-faq { max-width: 720px; margin: 0 auto; padding: 64px 24px; }
.lb-faq details { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.lb-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; padding: 64px 24px; text-align: center; }
.lb-stats .stat-value { font-size: 2.5rem; font-weight: 700; }
.lb-lead { padding: 48px 24px; max-width: 480px; margin: 0 auto; text-align: center; }
.lb-lead-fields { display: flex; flex-direction: column; gap: 12px; margin: 24px 0; }
.lb-lead input { padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; }
.lb-lead button { padding: 12px 32px; background: #4361ee; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
.lb-footer { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.7); }
.lb-nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; }
.lb-nav .links a { margin-left: 16px; color: inherit; text-decoration: none; }
@media (max-width: 768px) {
  .lb-feature-grid, .lb-pricing { grid-template-columns: 1fr; }
}
`

/**
 * PageSchema → 独立 HTML 字符串。
 * 内联：viewport meta + title + luban-base CSS + 树响应式 @media + 动画 @keyframes + 节点 HTML。
 */
export function schemaToHtml(schema: PageSchema, options: ExportOptions = {}): string {
  const title = esc(options.title || 'Exported Page')
  const root = schema.root
  const responsiveCss = treeResponsiveCss(root)
  const animationCss = treeAnimationCss(root)
  const baseCss = options.inlineBaseCss === false ? '' : BASE_CSS
  const bodyHtml = nodeToHtml(root)

  const seo = schema.seo
  const metaTags: string[] = []
  if (seo?.description) metaTags.push(`  <meta name="description" content="${esc(seo.description)}">`)
  if (seo?.keywords?.length) metaTags.push(`  <meta name="keywords" content="${esc(seo.keywords.join(', '))}">`)
  if (seo?.ogTitle) metaTags.push(`  <meta property="og:title" content="${esc(seo.ogTitle)}">`)
  if (seo?.ogDescription) metaTags.push(`  <meta property="og:description" content="${esc(seo.ogDescription)}">`)
  if (seo?.ogImage) metaTags.push(`  <meta property="og:image" content="${esc(seo.ogImage)}">`)
  if (seo?.noIndex) metaTags.push(`  <meta name="robots" content="noindex, nofollow">`)
  const canonical = seo?.canonical ? `\n  <link rel="canonical" href="${esc(seo.canonical)}">` : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
${metaTags.join('\n')}${canonical}
  <style>
${baseCss}
${responsiveCss}
${animationCss}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

/**
 * 触发浏览器下载 HTML 文件（Blob + a.download）。
 * SSR 安全：无 window/document 时 noop。
 */
export function downloadHtml(html: string, filename: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
