/**
 * Dashboard.spec.ts — 工作台四态单测（luban-review R2 补测）。
 *
 * 覆盖：
 *  - getSites 失败 → 主区 ElResult error + 重试按钮，不再吞成空态（无「免费开通」CTA）；
 *  - 重试恢复：失败一次 → 点重试 → 统计卡正常渲染；
 *  - 成功且无站点 → 空态引导 CTA；
 *  - getUsers 失败 → 站点统计正常、用户数显「—」（统计不可信不冒充 0）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { routerPush, getSitesMock, getUsersMock, getPagesMock } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  getSitesMock: vi.fn(),
  getUsersMock: vi.fn(),
  getPagesMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}))

vi.mock('@/api/site', () => ({
  getSites: (...args: unknown[]) => getSitesMock(...args),
}))

vi.mock('@/api/user', () => ({
  getUsers: (...args: unknown[]) => getUsersMock(...args),
}))

vi.mock('@/api/page', () => ({
  getPages: (...args: unknown[]) => getPagesMock(...args),
}))

import Dashboard from '../Dashboard.vue'

const RouterLinkStub = { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' }

function mountDashboard() {
  return mount(Dashboard, { global: { components: { RouterLink: RouterLinkStub } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUsersMock.mockResolvedValue({ data: { list: [], total: 5 } })
})

describe('Dashboard.vue 错误态', () => {
  it('getSites 失败 → 主区 ElResult error + 重试按钮，无空态 CTA', async () => {
    getSitesMock.mockRejectedValue(new Error('backend down'))
    const wrapper = mountDashboard()
    await flushPromises()

    const result = wrapper.findComponent({ name: 'ElResult' })
    expect(result.exists()).toBe(true)
    expect(wrapper.text()).toContain('backend down')
    const retry = wrapper.findAll('button').find((b) => b.text() === '重试')
    expect(retry).toBeTruthy()
    // 关键：错误不得被吞成「无站点」空态误导开通
    expect(wrapper.text()).not.toContain('免费开通')
    expect(wrapper.findComponent({ name: 'ElEmpty' }).exists()).toBe(false)
  })

  it('重试成功 → 错误态恢复为统计视图', async () => {
    getSitesMock.mockRejectedValueOnce(new Error('backend down'))
    getSitesMock.mockResolvedValueOnce({ data: [{ id: 's1' }, { id: 's2' }] })
    getPagesMock.mockResolvedValue({ data: [{ id: 'p1' }] })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElResult' }).exists()).toBe(true)

    const retry = wrapper.findAll('button').find((b) => b.text() === '重试')!
    await retry.trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElResult' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('站点数')
    expect(wrapper.text()).toContain('快捷入口')
  })
})

describe('Dashboard.vue 空态与统计', () => {
  it('加载成功且无站点 → 开通引导 CTA', async () => {
    getSitesMock.mockResolvedValue({ data: [] })
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElEmpty' }).exists()).toBe(true)
    const cta = wrapper.findAll('button').find((b) => b.text() === '免费开通')
    expect(cta).toBeTruthy()
  })

  it('getUsers 失败 → 用户数显「—」，站点统计不受影响', async () => {
    getSitesMock.mockResolvedValue({ data: [{ id: 's1' }] })
    getUsersMock.mockRejectedValue(new Error('user down'))
    getPagesMock.mockResolvedValue({ data: [] })
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('站点数')
    expect(wrapper.text()).toContain('—')
    // 站点主数据成功 → 不进入整页错误态
    expect(wrapper.findComponent({ name: 'ElResult' }).exists()).toBe(false)
  })
})
