/**
 * featuregates.spec.ts — FeatureGate 开关单测。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isFeatureEnabled, FeatureGate } from '@/featuregates'

describe('featuregates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('env 未设 → 默认值（ai_assistant_enabled 默认 true）', () => {
    vi.stubGlobal('import', { meta: { env: {} } })
    // import.meta.env 直接读，模拟未设
    expect(isFeatureEnabled('ai_assistant_enabled')).toBe(true)
  })

  it('FeatureGate.aiAssistant 反映 ai_assistant_enabled', () => {
    expect(FeatureGate.aiAssistant()).toBe(true)
  })

  it('未知 key 默认 false', () => {
    expect(isFeatureEnabled('unknown_feature')).toBe(false)
  })
})
