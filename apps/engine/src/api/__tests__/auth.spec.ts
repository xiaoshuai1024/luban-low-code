/**
 * auth.spec.ts — 注册三接口客户端单测（signup-billing-onboarding T-eng-1）。
 *
 * mock @/api/request 的 axios 实例（先例 form.spec.ts），验证 URL/payload 契约：
 *  - login 既有契约不回归；
 *  - register → POST /auth/register {username,email,password}；
 *  - verifyCode → POST /auth/register/verify {email,code}；
 *  - resendCode → POST /auth/register/resend {email}。
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
import { login, register, verifyCode, resendCode } from '@/api/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('auth api（注册扩展）', () => {
  it('login → POST /auth/login（既有契约）', () => {
    login({ username: 'test', password: 'test' })
    expect(request.post).toHaveBeenCalledWith('/auth/login', {
      username: 'test',
      password: 'test',
    })
  })

  it('register → POST /auth/register {username,email,password}', () => {
    register({ username: 'alice', email: 'a@b.com', password: 'pass1234' })
    expect(request.post).toHaveBeenCalledWith('/auth/register', {
      username: 'alice',
      email: 'a@b.com',
      password: 'pass1234',
    })
  })

  it('verifyCode → POST /auth/register/verify {email,code}', () => {
    verifyCode({ email: 'a@b.com', code: '123456' })
    expect(request.post).toHaveBeenCalledWith('/auth/register/verify', {
      email: 'a@b.com',
      code: '123456',
    })
  })

  it('resendCode → POST /auth/register/resend {email}', () => {
    resendCode({ email: 'a@b.com' })
    expect(request.post).toHaveBeenCalledWith('/auth/register/resend', {
      email: 'a@b.com',
    })
  })
})
