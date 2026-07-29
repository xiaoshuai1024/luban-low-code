import { reactive, readonly } from 'vue'

/**
 * useFeatureGate — engine 作用域特性开关（plan §6.5）。
 *
 * 支持的 key（默认全开，可经 env VITE_FEATURE_* 或运行时 setFeatureGate 关闭）：
 *   - editor.undo        关闭行为：隐藏撤销/重做按钮
 *   - editor.shortcuts   关闭行为：不绑 keydown
 *   - editor.datasource  关闭行为：隐藏属性面板数据源分区
 *   - editor.events      关闭行为：隐藏属性面板事件分区
 *   - ai.assistant       关闭行为：隐藏 AI 助手入口/抽屉，编辑器回归原状（plan P1-T8 回滚）
 *   - ai.design_to_page  关闭行为：隐藏 AI 面板「设计稿」tab（plan P2-T4 回滚）
 *
 * env 映射（自动）：key 点号→下划线大写。如 ai.assistant → VITE_FEATURE_AI_ASSISTANT。
 *
 * 回滚链：关 FeatureGate 即可降级到对应特性之前的行为（计划「回滚」段依赖此机制）。
 */
export type EngineFeatureKey =
  | 'editor.undo'
  | 'editor.shortcuts'
  | 'editor.datasource'
  | 'editor.events'
  | 'ai.assistant'
  | 'ai.design_to_page'

const DEFAULTS: Record<EngineFeatureKey, boolean> = {
  'editor.undo': true,
  'editor.shortcuts': true,
  'editor.datasource': true,
  'editor.events': true,
  'ai.assistant': true,
  'ai.design_to_page': true,
}

/** 运行时可注入覆盖（app 启动时 setFeatureGate({...})）。 */
const overrides: Partial<Record<EngineFeatureKey, boolean>> = reactive({})

function envValue(key: EngineFeatureKey): boolean | undefined {
  // editor.undo → VITE_FEATURE_EDITOR_UNDO
  const envName = `VITE_FEATURE_${key.toUpperCase().replace(/\./g, '_')}`
  const raw = (import.meta.env as Record<string, unknown>)[envName]
  if (raw === undefined) return undefined
  return String(raw) === 'true'
}

/** 程序化覆盖（测试或 app 初始化注入；优先级高于 env）。 */
export function setFeatureGate(
  patch: Partial<Record<EngineFeatureKey, boolean>>,
): void {
  Object.assign(overrides, patch)
}

export function useFeatureGate() {
  function isEnabled(key: EngineFeatureKey): boolean {
    if (overrides[key] !== undefined) return overrides[key] as boolean
    const ev = envValue(key)
    if (ev !== undefined) return ev
    return DEFAULTS[key]
  }
  return { isEnabled, overrides: readonly(overrides) }
}
