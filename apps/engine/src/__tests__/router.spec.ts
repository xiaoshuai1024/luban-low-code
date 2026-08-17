import { describe, it, expect } from 'vitest'
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
})
