/**
 * features.spec — FeatureGate 开关单测（D15-D1）。
 *
 * 验证：
 *  - 默认全开（env 未定义时）；
 *  - env='false'/'0' 关闭；
 *  - env='true'/'1'/其他值 开；
 *  - 未登记 key 抛错（防拼写错误）。
 *
 * import.meta.env 在 vitest jsdom 环境下可读可写（Vite 注入）；测试通过 vi.stubEnv
 * 改 env 后重新 import 模块，触发 envBool 重新求值。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('FeatureGate features (D15-D1)', () => {
  beforeEach(() => {
    // 清掉所有 stub env，模拟"未定义 → 默认全开"
    vi.unstubAllEnvs()
  })

  it('默认全开（env 未定义）', async () => {
    vi.resetModules()
    const { FEATURES } = await import('../features')
    expect(FEATURES.style).toBe(true)
    expect(FEATURES.datasourceManage).toBe(true)
    expect(FEATURES.testConnect).toBe(true)
    expect(FEATURES.treeLockHide).toBe(true)
    expect(FEATURES.events).toBe(true)
    expect(FEATURES.datasource).toBe(true)
  })

  it("env='false' → 关闭", async () => {
    vi.stubEnv('VITE_FEATURE_STYLE', 'false')
    vi.stubEnv('VITE_FEATURE_TEST_CONNECT', 'false')
    vi.resetModules()
    const { FEATURES } = await import('../features')
    expect(FEATURES.style).toBe(false)
    expect(FEATURES.testConnect).toBe(false)
    // 其他未 stub 的仍为 true
    expect(FEATURES.datasourceManage).toBe(true)
  })

  it("env='0' → 关闭", async () => {
    vi.stubEnv('VITE_FEATURE_EVENTS', '0')
    vi.resetModules()
    const { FEATURES } = await import('../features')
    expect(FEATURES.events).toBe(false)
  })

  it("env='true'/'1'/任意非false值 → 开", async () => {
    vi.stubEnv('VITE_FEATURE_STYLE', 'true')
    vi.stubEnv('VITE_FEATURE_DATASOURCE', '1')
    vi.stubEnv('VITE_FEATURE_TREE_LOCK_HIDE', 'yes')
    vi.resetModules()
    const { FEATURES } = await import('../features')
    expect(FEATURES.style).toBe(true)
    expect(FEATURES.datasource).toBe(true)
    expect(FEATURES.treeLockHide).toBe(true)
  })

  it('isFeatureEnabled 已登记 key 返回对应布尔', async () => {
    vi.resetModules()
    const { isFeatureEnabled } = await import('../features')
    expect(isFeatureEnabled('style')).toBe(true)
    expect(isFeatureEnabled('datasourceManage')).toBe(true)
  })

  it('isFeatureEnabled 未登记 key → 抛错（防拼写错误静默 false）', async () => {
    vi.resetModules()
    const { isFeatureEnabled } = await import('../features')
    expect(() => isFeatureEnabled('styple' as never)).toThrow(/unknown FeatureKey/)
  })
})
