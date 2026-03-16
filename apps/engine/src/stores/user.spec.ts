import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { clearToken } from '@/api/request'
import { useUserStore } from './user'

describe('useUserStore', () => {
  beforeEach(() => {
    clearToken()
    setActivePinia(createPinia())
  })

  it('initial state', () => {
    const store = useUserStore()
    expect(store.username).toBeNull()
    expect(store.name).toBeNull()
    expect(store.isLoggedIn).toBe(false)
  })

  it('setAuth sets token and user', () => {
    const store = useUserStore()
    store.setAuth('jwt-123', { username: 'admin', name: '管理员' })
    expect(store.token).toBe('jwt-123')
    expect(store.username).toBe('admin')
    expect(store.name).toBe('管理员')
    expect(store.isLoggedIn).toBe(true)
  })

  it('clearAuth resets state', () => {
    const store = useUserStore()
    store.setAuth('jwt-123', { username: 'admin' })
    store.clearAuth()
    expect(store.token).toBeNull()
    expect(store.username).toBeNull()
    expect(store.name).toBeNull()
    expect(store.isLoggedIn).toBe(false)
  })
})
