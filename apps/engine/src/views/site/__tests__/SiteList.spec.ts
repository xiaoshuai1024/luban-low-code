/**
 * SiteList.spec.ts — 站点列表 #empty 插槽分态单测（luban-review R2 补测）。
 *
 * 覆盖：
 *  - fetchList 失败 → #empty 显示错误描述 + 重试按钮（复用 fetchList），无「免费开通」CTA；
 *  - 重试成功 → 错误态恢复为表格数据行；
 *  - 真空态（成功且无站点）→ 既有「还没有站点 + 免费开通」引导。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { routerPush, getSitesMock } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  getSitesMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}))

vi.mock('@/api/site', () => ({
  getSites: (...args: unknown[]) => getSitesMock(...args),
  createSite: vi.fn(),
  updateSite: vi.fn(),
  deleteSite: vi.fn(),
}))

import SiteList from '../SiteList.vue'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SiteList.vue #empty 分态', () => {
  it('getSites 失败 → 错误描述 + 重试按钮，无空态 CTA', async () => {
    getSitesMock.mockRejectedValue(new Error('sites down'))
    const wrapper = mount(SiteList)
    await flushPromises()

    const result = wrapper.findComponent({ name: 'ElResult' })
    expect(result.exists()).toBe(true)
    expect(wrapper.text()).toContain('sites down')
    const retry = wrapper.findAll('button').find((b) => b.text() === '重试')
    expect(retry).toBeTruthy()
    // 失败不得显示成「还没有站点」空态误导开通
    expect(wrapper.text()).not.toContain('免费开通')
    expect(wrapper.findComponent({ name: 'ElEmpty' }).exists()).toBe(false)
  })

  it('重试成功 → 恢复表格数据行', async () => {
    getSitesMock.mockRejectedValueOnce(new Error('sites down'))
    getSitesMock.mockResolvedValueOnce({
      data: [{ id: 's1', name: '站点 A', slug: 'a', baseUrl: '', status: 'active' }],
    })
    const wrapper = mount(SiteList)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElResult' }).exists()).toBe(true)

    const retry = wrapper.findAll('button').find((b) => b.text() === '重试')!
    await retry.trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElResult' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('站点 A')
  })

  it('成功且无站点 → 真空态「免费开通」CTA', async () => {
    getSitesMock.mockResolvedValue({ data: [] })
    const wrapper = mount(SiteList)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ElEmpty' }).exists()).toBe(true)
    const cta = wrapper.findAll('button').find((b) => b.text() === '免费开通')
    expect(cta).toBeTruthy()
    expect(wrapper.findComponent({ name: 'ElResult' }).exists()).toBe(false)
  })
})
