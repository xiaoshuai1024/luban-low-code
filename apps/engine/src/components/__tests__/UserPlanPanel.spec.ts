/**
 * UserPlanPanel.spec.ts — 用户菜单套餐/用量面板单测（signup-billing-onboarding T-eng-4）。
 *
 * 覆盖（§9.5 签名）：plan/usage 未传自取；独立失败显「—」不阻断；
 * dict-tag 中文（生效中/试用中/已过期）；ElProgress 用量文本；limit=0 → 不限；
 * plan 未知（null）→ 限额显「—」（R2）；refresh() 重拉（dropdown 打开时由布局调用，R2）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { getMyPlanMock, getUsageMock } = vi.hoisted(() => ({
  getMyPlanMock: vi.fn(),
  getUsageMock: vi.fn(),
}))

vi.mock('@/api/billing', () => ({
  getMyPlan: (...args: unknown[]) => getMyPlanMock(...args),
  getUsage: (...args: unknown[]) => getUsageMock(...args),
}))

import UserPlanPanel from '../UserPlanPanel.vue'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UserPlanPanel 自取数据（未传 props）', () => {
  it('getMyPlan 返回含 usage/quota → 渲染套餐名 + 生效中 + 两条用量', async () => {
    getMyPlanMock.mockResolvedValue({
      data: {
        planCode: 'free',
        planName: 'Free',
        status: 'active',
        usage: { leads: 40, pages: 2, visits: 0 },
        quota: { leads: 100, pages: 3, visits: 0 },
      },
    })
    const wrapper = mount(UserPlanPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('当前套餐')
    expect(wrapper.text()).toContain('Free')
    expect(wrapper.text()).toContain('生效中')
    expect(wrapper.text()).toContain('页面数')
    expect(wrapper.text()).toContain('2 / 3')
    expect(wrapper.text()).toContain('本月留资')
    expect(wrapper.text()).toContain('40 / 100')
    // usage 已随 plan 返回 → 不再单独调 getUsage
    expect(getUsageMock).not.toHaveBeenCalled()
  })

  it('plan 无 usage → 回退调 getUsage', async () => {
    getMyPlanMock.mockResolvedValue({
      data: { planCode: 'free', planName: 'Free', status: 'active', quota: { leads: 100, pages: 3, visits: 0 } },
    })
    getUsageMock.mockResolvedValue({ data: { period: '2026-08', leads: 5, pages: 1, visits: 0 } })
    const wrapper = mount(UserPlanPanel)
    await flushPromises()
    expect(getUsageMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('1 / 3')
    expect(wrapper.text()).toContain('5 / 100')
  })

  it('加载失败 → 显「—」不阻断', async () => {
    getMyPlanMock.mockRejectedValue(new Error('down'))
    getUsageMock.mockRejectedValue(new Error('down'))
    const wrapper = mount(UserPlanPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('—')
    // 仍渲染面板骨架（不抛错、不阻断菜单）
    expect(wrapper.find('.user-plan-panel').exists()).toBe(true)
  })

  it('trialing → 试用中', async () => {
    getMyPlanMock.mockResolvedValue({
      data: { planCode: 'starter', planName: 'Starter', status: 'trialing', trialEndsAt: '2026-08-31T00:00:00Z' },
    })
    const wrapper = mount(UserPlanPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('试用中')
  })
})

describe('UserPlanPanel props 注入（不自取）', () => {
  it('传入 plan/usage → 不调 API；quota=0 显示「不限」', async () => {
    const wrapper = mount(UserPlanPanel, {
      props: {
        plan: {
          planCode: 'growth',
          planName: 'Growth',
          status: 'active',
          quota: { leads: 0, pages: 0, visits: 0 },
        },
        usage: { period: '2026-08', leads: 120, pages: 12, visits: 0 },
      },
    })
    await flushPromises()
    expect(getMyPlanMock).not.toHaveBeenCalled()
    expect(getUsageMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Growth')
    expect(wrapper.text()).toContain('12 / 不限')
    expect(wrapper.text()).toContain('120 / 不限')
  })

  it('超限 → ElProgress 警示（exception）', async () => {
    const wrapper = mount(UserPlanPanel, {
      props: {
        plan: {
          planCode: 'free',
          planName: 'Free',
          status: 'active',
          quota: { leads: 100, pages: 3, visits: 0 },
        },
        usage: { period: '2026-08', leads: 120, pages: 3, visits: 0 },
      },
    })
    await flushPromises()
    const bars = wrapper.findAll('.el-progress')
    expect(bars.some((b) => b.classes().includes('is-exception'))).toBe(true)
    expect(wrapper.text()).toContain('120 / 100')
  })

  it('plan 未知（null）→ 限额显「—」而非「不限」（0 才是不限）', async () => {
    // 仅传 usage：plan 自取返回 null（如 getMyPlan 无订阅回退失败的兜底态）
    getMyPlanMock.mockResolvedValue({ data: null })
    const wrapper = mount(UserPlanPanel, {
      props: { usage: { period: '2026-08', leads: 5, pages: 1, visits: 0 } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('1 / —')
    expect(wrapper.text()).toContain('5 / —')
    expect(wrapper.text()).not.toContain('不限')
  })
})

describe('UserPlanPanel refresh()（dropdown 打开重拉）', () => {
  it('refresh() → 重拉 getMyPlan/getUsage，数据更新', async () => {
    getMyPlanMock.mockResolvedValueOnce({
      data: { planCode: 'free', planName: 'Free', status: 'active' },
    })
    getUsageMock.mockResolvedValueOnce({ data: { period: '2026-08', leads: 5, pages: 1, visits: 0 } })
    const wrapper = mount(UserPlanPanel)
    await flushPromises()
    expect(getMyPlanMock).toHaveBeenCalledTimes(1)
    expect(getUsageMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Free')
    expect(wrapper.text()).toContain('5 / —')

    // 重拉：套餐与用量均更新（模拟切换档位后再次打开菜单）
    getMyPlanMock.mockResolvedValueOnce({
      data: {
        planCode: 'starter',
        planName: 'Starter',
        status: 'active',
        usage: { leads: 40, pages: 2, visits: 0 },
        quota: { leads: 1000, pages: 10, visits: 0 },
      },
    })
    await wrapper.vm.refresh()
    await flushPromises()
    expect(getMyPlanMock).toHaveBeenCalledTimes(2)
    // plan 带 usage → 第二路 getUsage 不再需要
    expect(getUsageMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Starter')
    expect(wrapper.text()).toContain('2 / 10')
    expect(wrapper.text()).toContain('40 / 1000')
  })
})
