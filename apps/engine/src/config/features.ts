/**
 * features — FeatureGate 开关系统（D15-D1，wave1 §6.5 落地）。
 *
 * wave1 计划标记 FeatureGate 已完成但代码缺失；本模块从零搭建 engine 端开关层。
 *
 * 设计：
 *  - 每个 FeatureGate 对应一个 VITE_FEATURE_* 环境变量（Vite 默认 envPrefix=VITE_，
 *    自动暴露到 import.meta.env）；
 *  - 默认全开：env 不定义时 `?? true`，保证现有本地开发与构建零改动即可工作；
 *  - 关闭契约：env 值为 'false' 或 '0' 时视为关闭，其余（含 'true'/'1'/空）开。
 *  - 回滚首选手段：任一功能出问题，设对应 env 为 false 重启即可，无需回滚代码。
 *
 * 消费点（各加一层 v-if="isFeatureEnabled('xxx')"）：
 *  - PropertyPanel 样式分区 / 事件分区 / 数据源分区
 *  - DatasourceManageDialog 入口按钮 / 测试连通按钮
 *  - ComponentTree 锁定/隐藏按钮
 *
 * 与 AI 助手端对齐语义：AI 端 ai.* 开关用同样的布尔语义（见 ai 配套 config.py 注释）。
 */

/** 读 VITE_FEATURE_* 环境变量为布尔，未定义/空 → 默认值。 */
function envBool(key: string, dft: boolean): boolean {
  const raw = import.meta.env[key]
  if (raw === undefined || raw === null || raw === '') return dft
  return raw !== 'false' && raw !== '0'
}

/**
 * 全部 FeatureGate 开关。新增功能开关在此登记 + 同步 vite-env.d.ts ImportMetaEnv。
 */
export const FEATURES = {
  /** 样式属性面板（PropertyPanel 样式分区，W1-T7） */
  style: envBool('VITE_FEATURE_STYLE', true),
  /** 数据源管理弹窗（CRUD）入口按钮（R2） */
  datasourceManage: envBool('VITE_FEATURE_DATASOURCE_MANAGE', true),
  /** 数据源测试连通按钮（R2） */
  testConnect: envBool('VITE_FEATURE_TEST_CONNECT', true),
  /** ComponentTree 锁定/隐藏按钮 + L/H 快捷键（Y3） */
  treeLockHide: envBool('VITE_FEATURE_TREE_LOCK_HIDE', true),
  /** 事件动作分区（PropertyPanel 事件区） */
  events: envBool('VITE_FEATURE_EVENTS', true),
  /** 数据源绑定分区整体（PropertyPanel 数据源区） */
  datasource: envBool('VITE_FEATURE_DATASOURCE', true),
  // === V2 设计器 v2 开关（§5.3，默认全开，env 关闭）===
  /** V2-T4 响应式：per-breakpoint 样式 */
  responsive: envBool('VITE_FEATURE_RESPONSIVE', true),
  /** V2-T5 动画分区 */
  animation: envBool('VITE_FEATURE_ANIMATION', true),
  /** V2-T2 SEO 分区（页面级） */
  seo: envBool('VITE_FEATURE_SEO', true),
  /** V2-T3 模板入口（新建页选模板） */
  templates: envBool('VITE_FEATURE_TEMPLATES', true),
  /** V2-T7 CMS 内容集合入口 */
  cms: envBool('VITE_FEATURE_CMS', true),
  /** V2-T6 表单管理入口 */
  forms: envBool('VITE_FEATURE_FORMS', true),
  /** V2-T8 版本历史入口 */
  versionHistory: envBool('VITE_FEATURE_VERSION_HISTORY', true),
  /** V2-T9 出码导出入口 */
  export: envBool('VITE_FEATURE_EXPORT', true),
  /** V2-T10 站点级埋点配置 */
  analytics: envBool('VITE_FEATURE_ANALYTICS', true),
  /** V2-T11 多选批量 */
  multiSelect: envBool('VITE_FEATURE_MULTI_SELECT', true),
  /** V2-T12 对齐辅助线 */
  alignGuides: envBool('VITE_FEATURE_ALIGN_GUIDES', true),
} as const

export type FeatureKey = keyof typeof FEATURES

/**
 * 判断某 FeatureGate 是否启用。未登记的 key 抛错（防拼写错误静默返回 false）。
 *
 * @example
 * if (isFeatureEnabled('style')) { <样式分区/> }
 */
export function isFeatureEnabled(key: FeatureKey): boolean {
  if (!Object.prototype.hasOwnProperty.call(FEATURES, key)) {
    throw new Error(
      `[features] unknown FeatureKey "${key}"; register in FEATURES + vite-env.d.ts`
    )
  }
  return FEATURES[key]
}
