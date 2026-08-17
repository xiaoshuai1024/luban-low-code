/**
 * billing.spec.ts — billing API 客户端单测（signup-billing-onboarding T-eng-1）。
 *
 * mock @/api/request 的 axios 实例（先例 form.spec.ts），验证 URL/参数契约：
 *  - getPlans → GET /billing/plans（裸数组，billing.spec B1）；
 *  - getMyPlan → GET /billing/me；
 *  - getUsage → GET /billing/usage；
 *  - subscribe/createOrder → POST body {planCode}（裁定 #2 命名）；
 *  - getOrders → GET /billing/orders?page=&size=（{items,total} 分页，裁定 #3）。
 * 附 site.checkSlug 契约（GET /sites/slug-check?slug=）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/api/request', () => ({
  request: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { request } from '@/api/request'
import {
  getPlans,
  getMyPlan,
  getUsage,
  subscribe,
  createOrder,
  getOrders,
} from '@/api/billing'
import { checkSlug } from '@/api/site'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('billing api', () => {
  it('getPlans → GET /billing/plans（无参数，裸数组契约）', () => {
    getPlans()
    expect(request.get).toHaveBeenCalledWith('/billing/plans')
  })

  it('getMyPlan → GET /billing/me', () => {
    getMyPlan()
    expect(request.get).toHaveBeenCalledWith('/billing/me')
  })

  it('getUsage 无参 → GET /billing/usage（默认当月）', () => {
    getUsage()
    // 不对 params 实现细节做断言，仅锁定 URL 契约
    expect(vi.mocked(request.get).mock.calls[0]?.[0]).toBe('/billing/usage')
  })

  it('getUsage 带周期 → GET /billing/usage?period=2026-08', () => {
    getUsage('2026-08')
    expect(request.get).toHaveBeenCalledWith('/billing/usage', { params: { period: '2026-08' } })
  })

  it('subscribe → POST /billing/subscribe {planCode}', () => {
    subscribe('starter')
    expect(request.post).toHaveBeenCalledWith('/billing/subscribe', { planCode: 'starter' })
  })

  it('createOrder → POST /billing/orders {planCode}', () => {
    createOrder('free')
    expect(request.post).toHaveBeenCalledWith('/billing/orders', { planCode: 'free' })
  })

  it('getOrders → GET /billing/orders 带分页参数', () => {
    getOrders({ page: 2, size: 10 })
    expect(request.get).toHaveBeenCalledWith('/billing/orders', {
      params: { page: 2, size: 10 },
    })
  })
})

describe('site api slug 预检', () => {
  it('checkSlug → GET /sites/slug-check?slug=', () => {
    checkSlug('my-site')
    expect(request.get).toHaveBeenCalledWith('/sites/slug-check', {
      params: { slug: 'my-site' },
    })
  })
})
