/**
 * V2-T3 模板/区块库定义。
 *
 * 每个模板是一份完整 PageSchema 快照（root 节点树）+ 元信息（id/name/category/description/thumbnail）。
 * 新建页时 TemplatePicker 弹出供选择；选中后 schema 注入 PageEditor。
 * 空白模板（blank）提供从零开始。
 *
 * 模板覆盖行业：SaaS / 电商 / 教育 / 博客 / 落地页 / 个人主页 等。
 * thumbnail 用 emoji 占位（无需图片资源），消费方可用 CSS 渲染缩略图卡片。
 */
import type { PageSchema } from '@/types/schema'

export interface PageTemplate {
  id: string
  name: string
  category: 'blank' | 'saas' | 'ecommerce' | 'education' | 'blog' | 'landing' | 'portfolio'
  description: string
  thumbnail: string
  schema: PageSchema
}

/** 通用 hero 区块（多模板复用） */
function heroNode(title: string, subtitle: string, ctaText: string): import('@/types/schema').NodeSchema {
  return {
    id: 'tpl-hero',
    type: 'LubanHero',
    props: { title, subtitle, ctaText, layout: 'centered', backgroundColor: 'var(--lb-bg-dark)', textColor: 'var(--lb-text-on-dark)' },
  }
}

export const TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    name: '空白页',
    category: 'blank',
    description: '从零开始搭建',
    thumbnail: '📄',
    schema: {
      root: { id: 'root', type: 'LubanContainer', props: { maxWidth: 'full', padded: true }, children: [] },
    },
  },
  {
    id: 'saas-landing',
    name: 'SaaS 产品落地页',
    category: 'saas',
    description: 'Hero + 特性矩阵 + 定价 + CTA，适合 SaaS 产品首页',
    thumbnail: '🚀',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'lg', padded: true },
        children: [
          heroNode('一站式 SaaS 解决方案', '提升团队效率 10 倍，立即开始免费试用', '免费试用'),
          {
            id: 'tpl-features',
            type: 'LubanFeatureGrid',
            props: {
              heading: '核心特性',
              columns: 3,
              features: [
                { icon: '⚡', title: '高性能', description: '毫秒级响应' },
                { icon: '🔒', title: '安全可靠', description: '企业级加密' },
                { icon: '📈', title: '数据洞察', description: '实时分析' },
              ],
            },
          },
          {
            id: 'tpl-pricing',
            type: 'LubanPricing',
            props: {
              heading: '选择方案',
              highlightIndex: 1,
              plans: [
                { name: '入门', price: '¥0', period: '月', features: [{ text: '3 个项目', included: true }, { text: '社区支持', included: true }, { text: '高级分析', included: false }], ctaText: '开始使用' },
                { name: '专业', price: '¥99', period: '月', features: [{ text: '无限项目', included: true }, { text: '优先支持', included: true }, { text: '高级分析', included: true }], ctaText: '立即升级' },
              ],
            },
          },
          { id: 'tpl-cta', type: 'LubanCTA', props: { heading: '准备好开始了吗？', buttonText: '立即注册', buttonUrl: '#' } },
        ],
      },
    },
  },
  {
    id: 'saas-about',
    name: 'SaaS 关于我们',
    category: 'saas',
    description: '公司介绍 + 团队 + 客户证言',
    thumbnail: '🏢',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'lg', padded: true },
        children: [
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '关于我们', subtitle: '成立于 2020 年，致力于赋能每一家企业', layout: 'centered' } },
          {
            id: 'tpl-testimonials',
            type: 'LubanTestimonialCarousel',
            props: {
              testimonials: [
                { quote: '产品改变了我们的工作方式', author: '张经理', role: '某科技公司 CTO', rating: 5 },
                { quote: '强烈推荐', author: '李总监', role: '某零售品牌', rating: 5 },
              ],
            },
          },
        ],
      },
    },
  },
  {
    id: 'ecommerce-home',
    name: '电商首页',
    category: 'ecommerce',
    description: '导航 + Hero + 商品画廊 + 留资表单',
    thumbnail: '🛒',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'full', padded: false },
        children: [
          { id: 'tpl-nav', type: 'LubanNavbar', props: { brand: '我的商店', links: [{ label: '首页', url: '#' }, { label: '商品', url: '#' }] } },
          heroNode('新品上市', '精选好物，限时优惠', '立即抢购'),
          {
            id: 'tpl-gallery',
            type: 'LubanGallery',
            props: {
              columns: 3,
              images: [
                { src: '', alt: '商品1', caption: '热销商品' },
                { src: '', alt: '商品2', caption: '新品推荐' },
                { src: '', alt: '商品3', caption: '限时特价' },
              ],
            },
          },
          { id: 'tpl-lead', type: 'LubanLeadCapture', props: { heading: '订阅获取优惠', submitText: '订阅' } },
        ],
      },
    },
  },
  {
    id: 'ecommerce-promo',
    name: '电商促销页',
    category: 'ecommerce',
    description: '促销活动落地页，强转化设计',
    thumbnail: '🎁',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'full', padded: false },
        children: [
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '双 11 狂欢', subtitle: '全场 5 折起', ctaText: '立即抢购', layout: 'centered' } },
          {
            id: 'tpl-stats',
            type: 'LubanStats',
            props: {
              stats: [
                { value: '5', suffix: '折', label: '最低折扣' },
                { value: '24', suffix: 'h', label: '限时倒计时' },
                { value: '10000', suffix: '+', label: '已售件数' },
              ],
            },
          },
          { id: 'tpl-cta', type: 'LubanCTA', props: { heading: '错过再等一年', buttonText: '马上抢', buttonUrl: '#', fullWidth: true } },
        ],
      },
    },
  },
  {
    id: 'education-course',
    name: '教育课程页',
    category: 'education',
    description: '课程介绍 + 讲师 + 报名表单',
    thumbnail: '📚',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'lg', padded: true },
        children: [
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '前端工程师进阶课', subtitle: '从入门到精通，10 周系统学习', ctaText: '了解课程', layout: 'centered' } },
          {
            id: 'tpl-faq',
            type: 'LubanFAQ',
            props: {
              heading: '常见问题',
              items: [
                { question: '适合什么基础？', answer: '零基础也能学，由浅入深' },
                { question: '有作业批改吗？', answer: '每节课配套作业，讲师亲自批改' },
              ],
            },
          },
          { id: 'tpl-lead', type: 'LubanLeadCapture', props: { heading: '免费试听一节课', submitText: '预约试听', showEmail: true } },
        ],
      },
    },
  },
  {
    id: 'education-stats',
    name: '教育成果展示',
    category: 'education',
    description: '学员数据 + 证言墙',
    thumbnail: '🎓',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'lg', padded: true },
        children: [
          {
            id: 'tpl-stats',
            type: 'LubanStats',
            props: {
              stats: [
                { value: '50000', suffix: '+', label: '累计学员' },
                { value: '98', suffix: '%', label: '满意度' },
                { value: '4.9', label: '平均评分' },
              ],
            },
          },
          {
            id: 'tpl-testimonials',
            type: 'LubanTestimonialCarousel',
            props: {
              testimonials: [
                { quote: '学完拿到了大厂 offer', author: '小王', role: '前端工程师', rating: 5 },
              ],
            },
          },
        ],
      },
    },
  },
  {
    id: 'blog-home',
    name: '博客首页',
    category: 'blog',
    description: '导航 + Hero + 文章列表布局',
    thumbnail: '✍️',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'lg', padded: true },
        children: [
          { id: 'tpl-nav', type: 'LubanNavbar', props: { brand: '技术博客', links: [{ label: '首页', url: '#' }, { label: '关于', url: '#' }] } },
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '分享技术，记录成长', subtitle: '前端 / 后端 / DevOps', ctaText: '阅读文章', layout: 'centered' } },
          {
            id: 'tpl-text',
            type: 'LubanText',
            props: { content: '最新文章列表将在这里展示。', variant: 'body' },
          },
        ],
      },
    },
  },
  {
    id: 'landing-lead',
    name: '留资落地页',
    category: 'landing',
    description: '高转化留资页，Hero + 痛点 + 表单',
    thumbnail: '🎯',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'md', padded: true },
        children: [
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '免费获取行业报告', subtitle: '填写信息立即下载 2026 行业白皮书', ctaText: '下载报告', layout: 'centered' } },
          {
            id: 'tpl-features',
            type: 'LubanFeatureGrid',
            props: {
              heading: '报告亮点',
              columns: 2,
              features: [
                { icon: '📊', title: '权威数据', description: '基于 1000+ 企业调研' },
                { icon: '💡', title: '深度洞察', description: '行业趋势预测' },
              ],
            },
          },
          { id: 'tpl-lead', type: 'LubanLeadCapture', props: { heading: '立即下载', submitText: '获取报告', showName: true, showPhone: true, showEmail: true } },
        ],
      },
    },
  },
  {
    id: 'landing-event',
    name: '活动报名页',
    category: 'landing',
    description: '线上/线下活动报名',
    thumbnail: '📅',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'md', padded: true },
        children: [
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '2026 开发者大会', subtitle: '12 月 15 日 · 线上直播', ctaText: '免费报名', layout: 'centered' } },
          { id: 'tpl-cta', type: 'LubanCTA', props: { heading: '名额有限，先到先得', buttonText: '立即报名', buttonUrl: '#' } },
        ],
      },
    },
  },
  {
    id: 'portfolio-home',
    name: '个人作品集',
    category: 'portfolio',
    description: '个人主页，作品展示 + 联系方式',
    thumbnail: '👤',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'lg', padded: true },
        children: [
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '你好，我是设计师', subtitle: 'UI/UX 设计师 · 5 年经验', ctaText: '查看作品', layout: 'centered' } },
          {
            id: 'tpl-gallery',
            type: 'LubanGallery',
            props: {
              columns: 2,
              images: [
                { src: '', alt: '作品1', caption: 'App 重设计' },
                { src: '', alt: '作品2', caption: '品牌视觉' },
              ],
            },
          },
          { id: 'tpl-lead', type: 'LubanLeadCapture', props: { heading: '合作邀请', submitText: '联系我' } },
          { id: 'tpl-footer', type: 'LubanFooter', props: { copyright: '© 2026', columns: [] } },
        ],
      },
    },
  },
  {
    id: 'app-download',
    name: 'App 下载页',
    category: 'landing',
    description: '移动应用推广下载页',
    thumbnail: '📱',
    schema: {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'md', padded: true },
        children: [
          { id: 'tpl-hero', type: 'LubanHero', props: { title: '下载我们的 App', subtitle: 'iOS / Android 双端支持', ctaText: 'App Store', secondaryCtaText: 'Google Play', layout: 'split' } },
          {
            id: 'tpl-stats',
            type: 'LubanStats',
            props: {
              stats: [
                { value: '4.8', label: 'App Store 评分' },
                { value: '100万', suffix: '+', label: '下载量' },
              ],
            },
          },
        ],
      },
    },
  },
]

/** 按 category 分组（TemplatePicker 渲染用） */
export function groupTemplatesByCategory(): { category: string; templates: PageTemplate[] }[] {
  const categoryLabels: Record<PageTemplate['category'], string> = {
    blank: '空白',
    saas: 'SaaS / 软件',
    ecommerce: '电商',
    education: '教育',
    blog: '博客',
    landing: '落地页',
    portfolio: '个人主页',
  }
  const groups: Record<string, PageTemplate[]> = {}
  for (const t of TEMPLATES) {
    const label = categoryLabels[t.category]
    if (!groups[label]) groups[label] = []
    groups[label].push(t)
  }
  return Object.entries(groups).map(([category, templates]) => ({ category, templates }))
}

/** 按 id 取模板 */
export function getTemplate(id: string): PageTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
