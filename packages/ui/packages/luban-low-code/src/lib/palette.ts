/**
 * 设计器组件面板配置：从 getAllComponentMeta() 按 category 动态映射。
 *
 * D15-E4 调色板重组：从原「信息/表单」2 组扩展为 7 组，覆盖全部已注册物料：
 *  - 信息（content/layout/general/button 基础组件）
 *  - 布局（layout 容器/行/列/侧滑面板）—— 单列以便用户快速找到布局类
 *  - 表单（form 表单及控件）
 *  - 营销（marketing：Hero/CTA/Testimonial/LeadCapture/Navbar/Footer/...）
 *  - 导航（navigation：Menu/Tabs）
 *  - 反馈（feedback：Modal/Drawer/Toast）
 *  - 数据展示（data-display：Table）
 *
 * 历史问题：W1-T6 6 物料 + marketing 物料曾因 category 不在映射集而隐藏于调色板，
 * 用户拖不到。本重组让全部已注册物料首次进入调色板。
 *
 * @since 0.1.0（2 组） · D15-E4 0.2.0（7 组全量）
 */

import { getAllComponentMeta } from './componentMeta';

export type PaletteItem = { type: string; label: string };

/** 调色板分组（7 组，顺序即展示顺序） */
export type PaletteCategory =
  | '信息'
  | '布局'
  | '表单'
  | '营销'
  | '导航'
  | '反馈'
  | '数据展示';

/** 设计器组件面板分组 */
export type PaletteGroup = { category: PaletteCategory; items: PaletteItem[] };

/**
 * material category（registry 原始分类）→ palette 分组映射。
 *
 * layout 同时进「信息」和「布局」：信息组保留通用基础组件便于快速找，
 * 布局组单列容器类便于搭建。content（Banner 等非营销内容）进信息组。
 */
const CATEGORY_TO_PALETTE: Record<string, PaletteCategory[]> = {
  content: ['信息'],
  layout: ['信息', '布局'],
  general: ['信息'],
  button: ['信息'],
  form: ['表单'],
  marketing: ['营销'],
  navigation: ['导航'],
  feedback: ['反馈'],
  'data-display': ['数据展示'],
};

/** 调色板分组展示顺序（决定面板从上到下的分组顺序） */
const PALETTE_ORDER: PaletteCategory[] = [
  '信息',
  '布局',
  '表单',
  '营销',
  '导航',
  '反馈',
  '数据展示',
];

/** ComponentMeta.category（旧联合 string）→ palette 分组列表（可多组）。 */
function toPaletteCategories(category: string | undefined): PaletteCategory[] {
  if (!category) return [];
  return CATEGORY_TO_PALETTE[category] ?? [];
}

/**
 * 从 getAllComponentMeta 派生按 palette 分组分组的组件项。
 *
 * 同一物料可能进多个分组（如 layout 进信息+布局）；同一分组内按 type 去重，
 * 保持 registry 注册顺序（materials/index.ts 注册顺序），保证面板顺序稳定。
 */
function derivePaletteByCategory(): Record<PaletteCategory, PaletteItem[]> {
  const out = {} as Record<PaletteCategory, PaletteItem[]>;
  for (const cat of PALETTE_ORDER) {
    out[cat] = [];
  }
  for (const meta of getAllComponentMeta()) {
    const cats = toPaletteCategories(meta.category);
    for (const cat of cats) {
      out[cat].push({ type: meta.type, label: meta.label });
    }
  }
  return out;
}

/**
 * 获取按 7 组分组的组件列表，设计器面板应使用此列表渲染。
 * 空分组仍返回（items 为 []），保证分组顺序稳定；调用方可选择过滤空组。
 */
export function getPaletteGroups(): PaletteGroup[] {
  const byCat = derivePaletteByCategory();
  return PALETTE_ORDER.map((cat) => ({
    category: cat,
    items: [...byCat[cat]],
  }));
}

/**
 * 扁平的面板组件列表（按分组顺序，去重），兼容需要平铺列表的用法。
 */
export function getPaletteItems(): PaletteItem[] {
  const byCat = derivePaletteByCategory();
  const seen = new Set<string>();
  const items: PaletteItem[] = [];
  for (const cat of PALETTE_ORDER) {
    for (const it of byCat[cat]) {
      if (seen.has(it.type)) continue;
      seen.add(it.type);
      items.push(it);
    }
  }
  return items;
}

/**
 * 判断类型是否为面板中已注册的组件类型（可用于 add-node 校验）。
 *
 * 动态查询当前 registry 派生集合，覆盖全部已注册物料。
 */
export function isPaletteType(type: string): boolean {
  return getPaletteItems().some((item) => item.type === type);
}
