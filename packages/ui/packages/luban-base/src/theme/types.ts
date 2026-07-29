/**
 * V2-T1 主题系统类型定义。
 *
 * LubanThemeTokens：所有可运行时覆盖的 CSS 变量名（与 _variables.scss :root 层一一对应）。
 * 仅声明"可换肤"的 token；功能型 token（断点、间距单位数值）不在此列。
 */
export interface LubanThemeTokens {
  primary: string;
  secondary: string;
  surface: string;
  error: string;
  'text-primary': string;
  'text-secondary': string;
  bg: string;
  'bg-muted': string;
  'bg-elevated': string;
  'bg-dark': string;
  border: string;
  'border-strong': string;
  'text-on-dark': string;
  'text-heading': string;
  'text-body': string;
  'text-muted': string;
  accent: string;
  'accent-contrast': string;
  'success-bg': string;
  'success-text': string;
  warning: string;
  'star-active': string;
  'star-inactive': string;
}

/** Partial tokens：只覆盖部分键；未覆盖键保留当前值 */
export type PartialThemeTokens = Partial<LubanThemeTokens>;

/** 内置预设名（light = 默认；dark = 深色反色） */
export type LubanThemeName = 'light' | 'dark';
