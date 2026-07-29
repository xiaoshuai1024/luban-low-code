/**
 * Page Templates — Luban 页面模板列表。
 *
 * Resource URI: luban://templates
 * MIME: application/json
 *
 * 模板定义映射自 apps/engine/src/config/templates.ts。
 *
 * @since 0.1.0
 */

import type { ResourceDef } from './lib/resource-registry.js';

interface TemplateEntry {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  description: string;
  thumbnail: string;
  schemaSummary: string;
  /** Total number of top-level child nodes in the root container. */
  nodeCount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  blank: '空白',
  saas: 'SaaS / 软件',
  ecommerce: '电商',
  education: '教育',
  blog: '博客',
  landing: '落地页',
  portfolio: '个人主页',
};

const TEMPLATES: TemplateEntry[] = [
  {
    id: 'blank',
    name: '空白页',
    category: 'blank',
    categoryLabel: '空白',
    description: '从零开始搭建',
    thumbnail: '📄',
    schemaSummary: '单个 LubanContainer 根节点，无子节点。',
    nodeCount: 0,
  },
  {
    id: 'saas-landing',
    name: 'SaaS 产品落地页',
    category: 'saas',
    categoryLabel: 'SaaS / 软件',
    description: 'Hero + 特性矩阵 + 定价 + CTA，适合 SaaS 产品首页',
    thumbnail: '🚀',
    schemaSummary:
      'LubanContainer → LubanHero(hero), LubanFeatureGrid(features), LubanPricing(pricing), LubanCTA(cta)',
    nodeCount: 4,
  },
  {
    id: 'saas-about',
    name: 'SaaS 关于我们',
    category: 'saas',
    categoryLabel: 'SaaS / 软件',
    description: '公司介绍 + 团队 + 客户证言',
    thumbnail: '🏢',
    schemaSummary:
      'LubanContainer → LubanHero(hero), LubanTestimonialCarousel(testimonials)',
    nodeCount: 2,
  },
  {
    id: 'ecommerce-home',
    name: '电商首页',
    category: 'ecommerce',
    categoryLabel: '电商',
    description: '导航 + Hero + 商品画廊 + 留资表单',
    thumbnail: '🛒',
    schemaSummary:
      'LubanContainer → LubanNavbar(nav), LubanHero(hero), LubanGallery(gallery), LubanLeadCapture(lead)',
    nodeCount: 4,
  },
  {
    id: 'ecommerce-promo',
    name: '电商促销页',
    category: 'ecommerce',
    categoryLabel: '电商',
    description: '促销活动落地页，强转化设计',
    thumbnail: '🎁',
    schemaSummary:
      'LubanContainer → LubanHero(hero), LubanStats(stats), LubanCTA(cta)',
    nodeCount: 3,
  },
  {
    id: 'education-course',
    name: '教育课程页',
    category: 'education',
    categoryLabel: '教育',
    description: '课程介绍 + 讲师 + 报名表单',
    thumbnail: '📚',
    schemaSummary:
      'LubanContainer → LubanHero(hero), LubanFAQ(faq), LubanLeadCapture(lead)',
    nodeCount: 3,
  },
  {
    id: 'education-stats',
    name: '教育成果展示',
    category: 'education',
    categoryLabel: '教育',
    description: '学员数据 + 证言墙',
    thumbnail: '🎓',
    schemaSummary:
      'LubanContainer → LubanStats(stats), LubanTestimonialCarousel(testimonials)',
    nodeCount: 2,
  },
  {
    id: 'blog-home',
    name: '博客首页',
    category: 'blog',
    categoryLabel: '博客',
    description: '导航 + Hero + 文章列表布局',
    thumbnail: '✍️',
    schemaSummary:
      'LubanContainer → LubanNavbar(nav), LubanHero(hero), LubanText(text)',
    nodeCount: 3,
  },
  {
    id: 'landing-lead',
    name: '留资落地页',
    category: 'landing',
    categoryLabel: '落地页',
    description: '高转化留资页，Hero + 痛点 + 表单',
    thumbnail: '🎯',
    schemaSummary:
      'LubanContainer → LubanHero(hero), LubanFeatureGrid(features), LubanLeadCapture(lead)',
    nodeCount: 3,
  },
  {
    id: 'landing-event',
    name: '活动报名页',
    category: 'landing',
    categoryLabel: '落地页',
    description: '线上/线下活动报名',
    thumbnail: '📅',
    schemaSummary: 'LubanContainer → LubanHero(hero), LubanCTA(cta)',
    nodeCount: 2,
  },
  {
    id: 'portfolio-home',
    name: '个人作品集',
    category: 'portfolio',
    categoryLabel: '个人主页',
    description: '个人主页，作品展示 + 联系方式',
    thumbnail: '👤',
    schemaSummary:
      'LubanContainer → LubanHero(hero), LubanGallery(gallery), LubanLeadCapture(lead), LubanFooter(footer)',
    nodeCount: 4,
  },
  {
    id: 'app-download',
    name: 'App 下载页',
    category: 'landing',
    categoryLabel: '落地页',
    description: '移动应用推广下载页',
    thumbnail: '📱',
    schemaSummary:
      'LubanContainer → LubanHero(hero), LubanStats(stats)',
    nodeCount: 2,
  },
];

export const pageTemplatesResource: ResourceDef = {
  uri: 'luban://templates',
  name: '页面模板',
  description: 'Luban 12 个页面模板列表，含结构快照摘要。',
  mimeType: 'application/json',
  load: () => {
    const grouped: Record<string, { category: string; categoryLabel: string; templates: TemplateEntry[] }> = {};
    for (const tpl of TEMPLATES) {
      const key = tpl.category;
      if (!grouped[key]) {
        grouped[key] = {
          category: key,
          categoryLabel: tpl.categoryLabel,
          templates: [],
        };
      }
      grouped[key].templates.push(tpl);
    }
    return JSON.stringify(
      {
        total: TEMPLATES.length,
        groups: Object.values(grouped),
      },
      null,
      2,
    );
  },
};
