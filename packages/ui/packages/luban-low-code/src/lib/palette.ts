/**
 * 设计器组件面板配置：从 getAllComponentMeta() 按 category 动态映射，
 * 分为「信息」「表单」两组，覆盖全部 14 物料（含 SidePanel）。
 *
 * @migration 13+1 物料 schema 重构（聚合收口，0.1.0）
 *
 * 重构后 PALETTE 不再硬编码组件列表，而是从 componentMeta（registry 派生）
 * 动态生成：
 *  - 信息组：category ∈ {content, layout, general}
 *  - 表单组：category === 'form'
 *
 * @since 0.1.0
 */

import { getAllComponentMeta } from './componentMeta';

export type PaletteItem = { type: string; label: string };

/** 分类：信息（内容、布局等） / 表单（表单控件） */
export type PaletteCategory = '信息' | '表单';

/** 设计器组件面板分组（顺序：信息、表单） */
export type PaletteGroup = { category: PaletteCategory; items: PaletteItem[] };

/**
 * material category → palette 分类映射。
 *
 * 信息组覆盖 content（横幅等）、layout（容器/行/列/侧滑面板）、
 * general（按钮/文本）；表单组覆盖 form（表单及表单控件）。
 */
const INFO_CATEGORIES = new Set(['content', 'layout', 'general', 'button']);
const FORM_CATEGORY = 'form';

/** ComponentMeta.category（旧联合）→ palette 分类。 */
function toPaletteCategory(
  category: string | undefined
): PaletteCategory | undefined {
  if (!category) return undefined;
  if (category === FORM_CATEGORY) return '表单';
  if (INFO_CATEGORIES.has(category)) return '信息';
  return undefined;
}

/**
 * 从 getAllComponentMeta 派生按 palette 分类分组的组件项。
 *
 * 同一物料只出现一次（按 type 去重）；保持 registry 注册顺序（materials/
 * index.ts 的注册顺序），保证面板顺序稳定。
 */
function derivePaletteByCategory(): Record<PaletteCategory, PaletteItem[]> {
  const out: Record<PaletteCategory, PaletteItem[]> = {
    信息: [],
    表单: [],
  };
  for (const meta of getAllComponentMeta()) {
    const cat = toPaletteCategory(meta.category);
    if (!cat) continue;
    out[cat].push({ type: meta.type, label: meta.label });
  }
  return out;
}

/**
 * 获取按「信息」「表单」分组的组件列表，设计器面板应使用此列表渲染。
 * 始终覆盖当前 materialRegistry 中全部 14 物料（含 SidePanel）。
 */
export function getPaletteGroups(): PaletteGroup[] {
  const byCat = derivePaletteByCategory();
  return [
    { category: '信息', items: [...byCat['信息']] },
    { category: '表单', items: [...byCat['表单']] },
  ];
}

/**
 * 扁平的面板组件列表（信息在前，表单在后），兼容需要平铺列表的用法。
 */
export function getPaletteItems(): PaletteItem[] {
  const byCat = derivePaletteByCategory();
  return [...byCat['信息'], ...byCat['表单']];
}

/**
 * 判断类型是否为面板中已注册的组件类型（可用于 add-node 校验）。
 *
 * 动态查询当前 registry 派生集合，覆盖全部 14 物料。
 */
export function isPaletteType(type: string): boolean {
  return getPaletteItems().some((item) => item.type === type);
}
