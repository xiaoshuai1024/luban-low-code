import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFeatureGate, setFeatureGate, type EngineFeatureKey } from './useFeatureGate'

/**
 * useFeatureGate 单测（plan §6.5 + close-tech-debt-1 1.5/1.6）。
 *
 * 覆盖：默认全开、运行时覆盖、env 覆盖、覆盖优先级（runtime > env > default）、
 * 关闭后所有 4 个 key 的 isEnabled 返回 false（回滚链依赖）。
 *
 * close-tech-debt-1：env 判定语义复用 features.ts SSOT（parseFeatureEnv）——
 * 仅 'false'/'0' 关，其余（含 '1'）开。
 */
describe('useFeatureGate', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    // reset runtime overrides between tests
    const keys: EngineFeatureKey[] = [
      'editor.undo',
      'editor.shortcuts',
      'editor.datasource',
      'editor.events',
    ]
    const reset: Partial<Record<EngineFeatureKey, boolean>> = {}
    for (const k of keys) reset[k] = true
    setFeatureGate(reset)
    setFeatureGate({ 'editor.undo': true, 'editor.shortcuts': true, 'editor.datasource': true, 'editor.events': true })
  })

  it('all four engine feature keys default to enabled', () => {
    const { isEnabled } = useFeatureGate()
    expect(isEnabled('editor.undo')).toBe(true)
    expect(isEnabled('editor.shortcuts')).toBe(true)
    expect(isEnabled('editor.datasource')).toBe(true)
    expect(isEnabled('editor.events')).toBe(true)
  })

  it('runtime override via setFeatureGate disables a key (rollback path)', () => {
    setFeatureGate({ 'editor.datasource': false })
    const { isEnabled } = useFeatureGate()
    expect(isEnabled('editor.datasource')).toBe(false)
    // other keys unaffected
    expect(isEnabled('editor.events')).toBe(true)
  })

  it('multiple keys can be toggled independently', () => {
    setFeatureGate({
      'editor.undo': false,
      'editor.shortcuts': false,
      'editor.datasource': true,
      'editor.events': false,
    })
    const { isEnabled } = useFeatureGate()
    expect(isEnabled('editor.undo')).toBe(false)
    expect(isEnabled('editor.shortcuts')).toBe(false)
    expect(isEnabled('editor.datasource')).toBe(true)
    expect(isEnabled('editor.events')).toBe(false)
  })

  it('re-enabling a previously-disabled key works', () => {
    setFeatureGate({ 'editor.undo': false })
    expect(useFeatureGate().isEnabled('editor.undo')).toBe(false)
    setFeatureGate({ 'editor.undo': true })
    expect(useFeatureGate().isEnabled('editor.undo')).toBe(true)
  })

  it("env='1' → 开启（features.ts SSOT 语义：仅 'false'/'0' 关，close-tech-debt-1 1.5）", () => {
    // ai.assistant 无 runtime override，走 env 分支（此前 String(raw)==='true' 会误判关）
    vi.stubEnv('VITE_FEATURE_AI_ASSISTANT', '1')
    expect(useFeatureGate().isEnabled('ai.assistant')).toBe(true)
    vi.stubEnv('VITE_FEATURE_AI_ASSISTANT', 'yes')
    expect(useFeatureGate().isEnabled('ai.assistant')).toBe(true)
    vi.stubEnv('VITE_FEATURE_AI_ASSISTANT', '0')
    expect(useFeatureGate().isEnabled('ai.assistant')).toBe(false)
    vi.stubEnv('VITE_FEATURE_AI_ASSISTANT', 'false')
    expect(useFeatureGate().isEnabled('ai.assistant')).toBe(false)
    vi.unstubAllEnvs()
    // env 未设 → 默认开
    expect(useFeatureGate().isEnabled('ai.assistant')).toBe(true)
  })
})
