/**
 * 设计器组件面板配置：始终包含所有基础组件，按「信息」「表单」分类。
 * 与 registry 中的组件保持一致，应用使用设计器时可直接使用本配置渲染面板。
 */

export type PaletteItem = { type: string; label: string };

/** 分类：信息（内容、布局等） / 表单（表单控件） */
export type PaletteCategory = '信息' | '表单';

/** 按分类的组件项（信息 + 表单，覆盖所有基础组件） */
const PALETTE_BY_CATEGORY: Record<PaletteCategory, PaletteItem[]> = {
  信息: [
    { type: 'LubanText', label: '文本' },
    { type: 'LubanBanner', label: '横幅' },
    { type: 'LubanButton', label: '按钮' },
    { type: 'LubanContainer', label: '容器' },
    { type: 'LubanRow', label: '行' },
    { type: 'LubanCol', label: '列' },
  ],
  表单: [
    { type: 'LubanForm', label: '表单' },
    { type: 'LubanInput', label: '输入框' },
    { type: 'LubanTextArea', label: '多行文本' },
    { type: 'LubanSelect', label: '选择' },
    { type: 'LubanCheckbox', label: '复选框' },
    { type: 'LubanRadioGroup', label: '单选' },
    { type: 'LubanSwitch', label: '开关' },
  ],
};

/** 设计器组件面板分组（顺序：信息、表单） */
export type PaletteGroup = { category: PaletteCategory; items: PaletteItem[] };

/**
 * 获取按「信息」「表单」分组的组件列表，设计器面板应使用此列表渲染。
 * 始终包含当前所有基础组件。
 */
export function getPaletteGroups(): PaletteGroup[] {
  return [
    { category: '信息', items: [...PALETTE_BY_CATEGORY['信息']] },
    { category: '表单', items: [...PALETTE_BY_CATEGORY['表单']] },
  ];
}

/** 所有面板组件类型集合（用于校验 drop 类型是否合法） */
const PALETTE_TYPES = new Set<string>(
  [...PALETTE_BY_CATEGORY['信息'], ...PALETTE_BY_CATEGORY['表单']].map(
    (item) => item.type
  )
);

/**
 * 扁平的面板组件列表（信息在前，表单在后），兼容需要平铺列表的用法。
 */
export function getPaletteItems(): PaletteItem[] {
  return [
    ...PALETTE_BY_CATEGORY['信息'],
    ...PALETTE_BY_CATEGORY['表单'],
  ];
}

/**
 * 判断类型是否为面板中已注册的组件类型（可用于 add-node 校验）。
 */
export function isPaletteType(type: string): boolean {
  return PALETTE_TYPES.has(type);
}
