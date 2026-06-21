/**
 * featuregates.ts — 功能开关（FeatureGate）。
 *
 * 读 import.meta.env.VITE_FEATURE_* （vite 注入）。未设置默认按 key 决定。
 *
 * 现有 key：
 *   ai_assistant_enabled — AI 助手面板（关闭则隐藏 AI 图标/抽屉，编辑器回归原状）
 *
 * 关闭语义：plan §6.5 — ai_assistant_enabled 关 → 隐藏 AI 图标/抽屉，
 *   编辑器其他功能不受影响。
 */

/** 所有 feature key 与默认值（env 未设时） */
const DEFAULTS: Record<string, boolean> = {
  ai_assistant_enabled: true,
}

function envFlag(key: string): boolean | undefined {
  const raw = import.meta.env[`VITE_FEATURE_${key.toUpperCase()}`]
  if (raw === undefined || raw === null || raw === '') return undefined
  return String(raw).toLowerCase() !== 'false' && raw !== '0'
}

export function isFeatureEnabled(key: keyof typeof DEFAULTS | string): boolean {
  const env = envFlag(key)
  if (env !== undefined) return env
  return DEFAULTS[key] ?? false
}

export const FeatureGate = {
  aiAssistant: () => isFeatureEnabled('ai_assistant_enabled'),
}
