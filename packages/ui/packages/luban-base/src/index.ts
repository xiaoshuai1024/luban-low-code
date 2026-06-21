export { default as LubanButton } from './lib/button/LubanButton.vue';
export type { ButtonVariant, ButtonColor, LubanButtonProps } from './lib/button/button-types';

export { default as LubanContainer } from './lib/layout/LubanContainer.vue';
export { default as LubanRow } from './lib/layout/LubanRow.vue';
export { default as LubanCol } from './lib/layout/LubanCol.vue';
export { default as LubanSidePanel } from './lib/layout/LubanSidePanel.vue';

export { default as LubanBanner } from './lib/content/LubanBanner.vue';
export { default as LubanText } from './lib/content/LubanText.vue';
export { default as LubanHero } from './lib/content/LubanHero.vue';
export { default as LubanCTA } from './lib/content/LubanCTA.vue';
export { default as LubanTestimonial } from './lib/content/LubanTestimonial.vue';
export { default as LubanLeadCapture } from './lib/content/LubanLeadCapture.vue';
export { default as LubanContentList } from './lib/content/LubanContentList.vue';

// === D15-E1 营销建站组件（marketing/ 子目录）===
export { default as LubanNavbar } from './lib/marketing/LubanNavbar.vue';
export { default as LubanFooter } from './lib/marketing/LubanFooter.vue';
export { default as LubanFeatureGrid } from './lib/marketing/LubanFeatureGrid.vue';
export { default as LubanStats } from './lib/marketing/LubanStats.vue';
export { default as LubanFAQ } from './lib/marketing/LubanFAQ.vue';
export { default as LubanPricing } from './lib/marketing/LubanPricing.vue';
export { default as LubanTestimonialCarousel } from './lib/marketing/LubanTestimonialCarousel.vue';
export { default as LubanGallery } from './lib/marketing/LubanGallery.vue';
export { default as LubanLogoCloud } from './lib/marketing/LubanLogoCloud.vue';

export { default as LubanForm } from './lib/form/LubanForm.vue';
export { default as LubanInput } from './lib/form/LubanInput.vue';
export { default as LubanTextArea } from './lib/form/LubanTextArea.vue';
export { default as LubanSelect } from './lib/form/LubanSelect.vue';
export { default as LubanCheckbox } from './lib/form/LubanCheckbox.vue';
export { default as LubanRadioGroup } from './lib/form/LubanRadioGroup.vue';
export { default as LubanSwitch } from './lib/form/LubanSwitch.vue';
export type {
  LubanInputType,
  LubanSelectOption,
  LubanRadioOption,
} from './lib/form/form-types';

// === V2-T1 主题系统（运行时换肤 API）===
// 顶层导入即触发 _variables.scss 的 :root 默认注入（由消费方 vite/webpack 处理 scss）。
// 这里只导出 JS API；CSS 变量层由 luban-base 的 styles 入口统一注入。
export {
  applyTheme,
  applyThemePreset,
  resetTheme,
  getCurrentTheme,
  getCurrentPreset,
  onThemeChange,
  LIGHT_PRESET,
  DARK_PRESET,
} from './theme';
export type {
  LubanThemeTokens,
  PartialThemeTokens,
  LubanThemeName,
} from './theme';
