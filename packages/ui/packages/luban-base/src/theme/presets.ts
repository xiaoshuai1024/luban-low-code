/**
 * V2-T1 主题预设。
 *
 * light = 与 _variables.scss 默认值一致（白底蓝主）。
 * dark = 反色主题：深底浅字，accent 保留蓝调但提高亮度。
 *
 * 预设只列覆盖键；未列出的键在 applyThemePreset 内会先 resetTheme 回默认再应用。
 */
import type { LubanThemeTokens } from './types';

export const LIGHT_PRESET: LubanThemeTokens = {
  primary: '#1976d2',
  secondary: '#9c27b0',
  surface: '#f5f5f5',
  error: '#d32f2f',
  'text-primary': 'rgba(0, 0, 0, 0.87)',
  'text-secondary': 'rgba(0, 0, 0, 0.6)',
  bg: '#ffffff',
  'bg-muted': '#f9fafb',
  'bg-elevated': '#ffffff',
  'bg-dark': '#1a1a2e',
  border: '#e5e7eb',
  'border-strong': '#d1d5db',
  'text-on-dark': '#ffffff',
  'text-heading': '#111827',
  'text-body': '#374151',
  'text-muted': '#6b7280',
  accent: '#4361ee',
  'accent-contrast': '#ffffff',
  'success-bg': '#ecfdf5',
  'success-text': '#065f46',
  warning: '#f59e0b',
  'star-active': '#f59e0b',
  'star-inactive': '#ddd',
};

export const DARK_PRESET: LubanThemeTokens = {
  primary: '#64b5f6',
  secondary: '#ce93d8',
  surface: '#1f2430',
  error: '#ef5350',
  'text-primary': 'rgba(255, 255, 255, 0.92)',
  'text-secondary': 'rgba(255, 255, 255, 0.65)',
  bg: '#161a23',
  'bg-muted': '#1f2430',
  'bg-elevated': '#222836',
  'bg-dark': '#0f1218',
  border: '#2e3445',
  'border-strong': '#3a4256',
  'text-on-dark': '#ffffff',
  'text-heading': '#f5f7fa',
  'text-body': '#d1d6e0',
  'text-muted': '#9aa3b2',
  accent: '#7c93ff',
  'accent-contrast': '#0f1218',
  'success-bg': '#0f2a22',
  'success-text': '#6ee7b7',
  warning: '#fbbf24',
  'star-active': '#fbbf24',
  'star-inactive': '#4b5563',
};
