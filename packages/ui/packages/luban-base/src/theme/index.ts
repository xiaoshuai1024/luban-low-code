/**
 * V2-T1 主题模块聚合出口。
 *
 * 消费：
 *   import { applyTheme, applyThemePreset, resetTheme, getCurrentTheme, onThemeChange } from 'luban-base/theme';
 *   applyTheme({ primary: '#ff0000' });           // 覆盖单 token
 *   applyThemePreset('dark');                      // 应用 dark 预设
 *   resetTheme();                                  // 回默认
 */
export {
  applyTheme,
  applyThemePreset,
  resetTheme,
  getCurrentTheme,
  getCurrentPreset,
  onThemeChange,
} from './theme';
export { LIGHT_PRESET, DARK_PRESET } from './presets';
export type {
  LubanThemeTokens,
  PartialThemeTokens,
  LubanThemeName,
} from './types';
