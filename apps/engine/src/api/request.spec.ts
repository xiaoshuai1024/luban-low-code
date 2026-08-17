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

  it('响应体非对象（无法归一）→ 友好中文文案，不透出 axios 英文原文', () => {
    const e = new axios.AxiosError('Network Error', 'ECONNABORTED', undefined, undefined, {
      status: 500,
      data: 'internal error',
    } as never)
    expect(extractApiError(e)).toEqual({ message: '网络异常，请检查连接后重试' })
  })

  it('响应体有 code 但 message 空 → 仍回传 code + 兜底中文文案', () => {
    const e = new axios.AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      data: { code: 'RATE_LIMITED', message: '' },
    } as never)
    expect(extractApiError(e)).toEqual({ code: 'RATE_LIMITED', message: '请求失败，请稍后重试' })
  })

  it('details 为字符串/null → 归一为 undefined', () => {
    const mk = (details: unknown) =>
      new axios.AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        data: { code: 'VERIFY_CODE_INVALID', message: '验证码错误', details },
      } as never)
    expect(extractApiError(mk('oops'))).toEqual({
      code: 'VERIFY_CODE_INVALID',
      message: '验证码错误',
      details: undefined,
    })
    expect(extractApiError(mk(null))).toEqual({
      code: 'VERIFY_CODE_INVALID',
      message: '验证码错误',
      details: undefined,
    })
  })

  it('无响应的 axios 错误（网络/超时）→ 友好中文文案', () => {
    const e = new axios.AxiosError('timeout of 15000ms exceeded')
    expect(extractApiError(e)).toEqual({ message: '网络异常，请检查连接后重试' })
  })

  it('非 axios 的普通 Error → message', () => {
    expect(extractApiError(new Error('解析失败'))).toEqual({ message: '解析失败' })
  })

  it('非 Error 的未知值 → 兜底文案', () => {
    expect(extractApiError('boom')).toEqual({ message: '请求失败' })
    expect(extractApiError(undefined)).toEqual({ message: '请求失败' })
  })
})
