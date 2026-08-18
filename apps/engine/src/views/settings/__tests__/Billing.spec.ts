/**
 * Billing.spec.ts — 套餐与订单页单测（signup-billing-onboarding T-eng-4）。
 *
 * 覆盖（§4.2.4）：
 *  - 当前订阅卡（plan 名 + dict-tag 生效中 + 试用到期）；
 *  - 三档对比表（当前档「当前」标记 + 其余「切换」按钮）；
 *  - 切换 = createOrder 0 元下单 → 成功刷新本页（getMyPlan/getOrders 重拉）；
 *  - INVALID_PLAN → 整页重载；页面加载失败 → ElResult+重试；订单失败 → 表区重试；
 *  - 订单表渲染（金额/状态中文 dict-tag/空态「暂无订单」）+ 分页翻页参数。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'

const { getPlansMock, getMyPlanMock, getOrdersMock, createOrderMock } = vi.hoisted(() => ({
  getPlansMock: vi.fn(),
  getMyPlanMock: vi.fn(),
  getOrdersMock: vi.fn(),
  createOrderMock: vi.fn(),
}))

vi.mock('@/api/billing', () => ({
  getPlans: (...args: unknown[]) => getPlansMock(...args),
  getMyPlan: (...args: unknown[]) => getMyPlanMock(...args),
  getOrders: (...args: unknown[]) => getOrdersMock(...args),
  createOrder: (...args: unknown[]) => createOrderMock(...args),
}))

vi.mock('@/api/request', async () => {
  const actual = await vi.importActual<typeof import('@/api/request')>('@/api/request')
  return { ...actual }
})

import Billing from '../Billing.vue'

const PLANS = [
  { planCode: 'free', name: 'Free', priceMonthly: 0, quotaLeads: 100, quotaPages: 3, quotaVisits: 0, trialDays: 0 },
  { planCode: 'starter', name: 'Starter', priceMonthly: 0, quotaLeads: 1000, quotaPages: 10, quotaVisits: 0, trialDays: 14 },
  { planCode: 'growth', name: 'Growth', priceMonthly: 0, quotaLeads: 10000, quotaPages: 50, quotaVisits: 0, trialDays: 0 },
]

const ORDERS = [
  {
    orderNo: 'NO-20260817-001',
    planCode: 'starter',
    amount: 0,
    status: 'paid',
    createdAt: '2026-08-17T10:00:00Z',
    paidAt: '2026-08-17T10:00:00Z',
  },
  {
    orderNo: 'NO-20260817-002',
    planCode: 'free',
    amount: 0,
    status: 'pending',
    createdAt: '2026-08-16T09:00:00Z',
  },
]

function apiError(status: number, body: { code?: string; message: string }) {
  return new axios.AxiosError(body.message, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: body,
  } as never)
}

function defaultMocks() {
  getPlansMock.mockResolvedValue({ data: PLANS })
  getMyPlanMock.mockResolvedValue({
    data: {
      planCode: 'free',
      planName: 'Free',
      status: 'active',
      usage: { leads: 40, pages: 2, visits: 0 },
      quota: { leads: 100, pages: 3, visits: 0 },
    },
  })
  getOrdersMock.mockResolvedValue({ data: { items: ORDERS, total: 12 } })
}

async function mountBilling() {
  const wrapper = mount(Billing)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  defaultMocks()
})

describe('Billing.vue 渲染', () => {
  it('当前订阅卡：Free + 生效中 + 试用到期 —', async () => {
    const wrapper = await mountBilling()
    expect(wrapper.text()).toContain('当前订阅')
    expect(wrapper.text()).toContain('Free')
    expect(wrapper.text()).toContain('生效中')
    expect(wrapper.text()).toContain('试用到期：—')
  })

  it('对比表：三档列 + 当前档标记 + 其余「切换」按钮 + 配额值', async () => {
    const wrapper = await mountBilling()
    expect(wrapper.text()).toContain('套餐对比')
    expect(wrapper.text()).toContain('Starter')
    expect(wrapper.text()).toContain('Growth')
    expect(wrapper.text()).toContain('14 天')
    expect(wrapper.text()).toContain('10000')
    // 操作行：free 当前 → 标记「当前」；starter/growth → 切换按钮 ×2
    const switchBtns = wrapper.findAll('button').filter((b) => b.text() === '切换')
    expect(switchBtns).toHaveLength(2)
  })

  it('订单表：订单号/套餐名/金额 ¥0.00/状态中文/分页总数', async () => {
    const wrapper = await mountBilling()
    expect(wrapper.text()).toContain('NO-20260817-001')
    expect(wrapper.text()).toContain('已支付')
    expect(wrapper.text()).toContain('待支付')
    expect(wrapper.text()).toContain('¥0.00')
    expect(wrapper.text()).toContain('12') // ElPagination total
    expect(getOrdersMock).toHaveBeenCalledWith({ page: 1, size: 10 })
  })

  it('订单空 → 「暂无订单」', async () => {
    getOrdersMock.mockResolvedValue({ data: { items: [], total: 0 } })
    const wrapper = await mountBilling()
    expect(wrapper.text()).toContain('暂无订单')
  })

  it('翻页 → getOrders 带新页码', async () => {
    const wrapper = await mountBilling()
    const pager = wrapper.findComponent({ name: 'ElPagination' })
    expect(pager.exists()).toBe(true)
    pager.vm.$emit('current-change', 2)
    await flushPromises()
    expect(getOrdersMock).toHaveBeenCalledWith({ page: 2, size: 10 })
  })
})

describe('Billing.vue 切换套餐', () => {
  it('点「切换」→ createOrder(planCode) → 刷新订阅与订单，当前档变更', async () => {
    createOrderMock.mockResolvedValue({ data: {} })
    const wrapper = await mountBilling()

    const starterBtn = wrapper.findAll('button').filter((b) => b.text() === '切换')[0]
    await starterBtn.trigger('click')
    await flushPromises()

    expect(createOrderMock).toHaveBeenCalledWith('starter')
    // 成功后刷新：getMyPlan / getOrders 至少各再调一次
    expect(getMyPlanMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(getOrdersMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('createOrder INVALID_PLAN → 整页重载（getPlans 重拉）', async () => {
    createOrderMock.mockRejectedValue(apiError(400, { code: 'INVALID_PLAN', message: 'bad plan' }))
    const wrapper = await mountBilling()
    expect(getPlansMock).toHaveBeenCalledTimes(1)

    const starterBtn = wrapper.findAll('button').filter((b) => b.text() === '切换')[0]
    await starterBtn.trigger('click')
    await flushPromises()
    expect(getPlansMock).toHaveBeenCalledTimes(2)
  })
})

describe('Billing.vue 四态', () => {
  it('订阅/套餐加载失败 → 整页 ElResult error + 重试恢复', async () => {
    getMyPlanMock.mockRejectedValueOnce(apiError(500, { message: 'backend down' }))
    const wrapper = await mountBilling()
    expect(wrapper.text()).toContain('backend down')
    expect(wrapper.findAll('button').some((b) => b.text() === '重试')).toBe(true)

    const retry = wrapper.findAll('button').find((b) => b.text() === '重试')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('当前订阅')
  })

  it('订单加载失败 → 订单区错误 + 重试', async () => {
    getOrdersMock.mockRejectedValueOnce(apiError(500, { message: 'orders down' }))
    const wrapper = await mountBilling()
    expect(wrapper.text()).toContain('订单加载失败，请稍后重试')
    // 页面主体仍在
    expect(wrapper.text()).toContain('当前订阅')

    const retry = wrapper.findAll('button').find((b) => b.text() === '重试')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('NO-20260817-001')
  })
})
