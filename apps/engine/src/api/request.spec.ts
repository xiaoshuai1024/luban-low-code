import { describe, it, expect, beforeEach } from 'vitest'
import axios from 'axios'
import { getToken, setToken, clearToken, extractApiError } from './request'

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

describe('extractApiError（BFF/Java 错误体归一，signup-billing-onboarding §9.5）', () => {
  it('axios 错误带 {code,message,details} 响应体 → 原样提取', () => {
    const e = new axios.AxiosError('req failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 409,
      data: { code: 'USERNAME_TAKEN', message: '用户名已被占用', details: { field: 'username' } },
    } as never)
    expect(extractApiError(e)).toEqual({
      code: 'USERNAME_TAKEN',
      message: '用户名已被占用',
      details: { field: 'username' },
    })
  })

  it('响应体无 message → 回落 axios message', () => {
    const e = new axios.AxiosError('Network Error', 'ECONNABORTED', undefined, undefined, {
      status: 500,
      data: 'internal error',
    } as never)
    expect(extractApiError(e)).toEqual({ message: 'Network Error' })
  })

  it('无响应的 axios 错误（网络/超时）→ Error.message', () => {
    const e = new axios.AxiosError('timeout of 15000ms exceeded')
    expect(extractApiError(e)).toEqual({ message: 'timeout of 15000ms exceeded' })
  })

  it('非 axios 的普通 Error → message', () => {
    expect(extractApiError(new Error('解析失败'))).toEqual({ message: '解析失败' })
  })

  it('非 Error 的未知值 → 兜底文案', () => {
    expect(extractApiError('boom')).toEqual({ message: '请求失败' })
    expect(extractApiError(undefined)).toEqual({ message: '请求失败' })
  })
})
