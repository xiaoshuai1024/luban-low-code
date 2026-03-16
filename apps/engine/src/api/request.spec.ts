import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getToken, setToken, clearToken } from './request'

describe('request token helpers', () => {
  beforeEach(() => {
    clearToken()
  })

  it('getToken returns null when not set', () => {
    expect(getToken()).toBeNull()
  })

  it('setToken and getToken', () => {
    setToken('abc')
    expect(getToken()).toBe('abc')
  })

  it('clearToken removes token', () => {
    setToken('abc')
    clearToken()
    expect(getToken()).toBeNull()
  })
})
