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
})
