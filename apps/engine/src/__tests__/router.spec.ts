import { describe, it, expect, vi } from 'vitest'

// === mock getToken：守卫分支只依赖登录态，不依赖 localStorage ===
const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }))
vi.mock('@/api/request', () => ({
  getToken: (...args: unknown[]) => getTokenMock(...args),
}))

import router from '@/router'

describe('Router', () => {
  it('has login route', () => {
    const route = router.getRoutes().find((r) => r.path === '/login')
    expect(route).toBeDefined()
    expect(route?.meta?.public).toBe(true)
  })

  it('has dashboard route', () => {
    const dashboard = router.getRoutes().find((r) => r.name === 'Dashboard')
    expect(dashboard).toBeDefined()
    expect(dashboard?.path).toBe('/dashboard')
  })

  it('has sites, users, settings routes', () => {
    const names = router.getRoutes().map((r) => r.name)
    expect(names).toContain('SiteList')
    expect(names).toContain('UserList')
    expect(names).toContain('Settings')
  })

  // === signup-billing-onboarding：注册/向导/套餐三路由 ===
  it('has /register route (public, signup-billing-onboarding)', () => {
    const route = router.getRoutes().find((r) => r.path === '/register')
    expect(route).toBeDefined()
    expect(route?.name).toBe('Register')
    expect(route?.meta?.public).toBe(true)
  })

  it('has /onboarding route (auth-guarded, not public)', () => {
    const route = router.getRoutes().find((r) => r.path === '/onboarding')
    expect(route).toBeDefined()
    expect(route?.name).toBe('Onboarding')
    expect(route?.meta?.public).toBeUndefined()
  })

  it('has /settings/billing route under default layout', () => {
    const route = router.getRoutes().find((r) => r.path === '/settings/billing')
    expect(route).toBeDefined()
    expect(route?.name).toBe('Billing')
  })

  // === 守卫：已登录访问 /register → 重定向 /dashboard（§9.1） ===
  // 真实导航会按需加载路由懒加载组件（DefaultLayout/Dashboard/Register + element-plus），
  // coverage 插桩下偶超 5s 默认超时，故放宽到 15s。
  it(
    '已登录（getToken 有值）访问 /register → 重定向 /dashboard',
    async () => {
      getTokenMock.mockReturnValue('jwt-1')
      await router.push('/register')
      expect(router.currentRoute.value.path).toBe('/dashboard')
      getTokenMock.mockReset()
    },
    15_000,
  )

  it(
    '未登录（getToken 为空）访问 /register → 停留注册页',
    async () => {
      getTokenMock.mockReturnValue(null)
      await router.push('/register')
      expect(router.currentRoute.value.path).toBe('/register')
      getTokenMock.mockReset()
    },
    15_000,
  )
})
