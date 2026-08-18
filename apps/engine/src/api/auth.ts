import { request, clearToken } from './request'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user?: { username: string; name?: string; role?: string }
}

export function login(payload: LoginPayload) {
  return request.post<LoginResult>('/auth/login', payload)
}

// === 注册（signup-billing-onboarding §9.2 契约）===

/** 注册提交载荷：Step1 表单四字段中的三个服务端字段 */
export interface RegisterPayload {
  username: string
  email: string
  password: string
}

/** register/resend 成功响应（devCode 仅 MAIL_DEV_ECHO 的 dev/e2e 环境返回） */
export interface RegisterResult {
  username: string
  /** 掩码邮箱（a***@domain.com），Step2 展示用 */
  emailMasked: string
  devCode?: string
}

/** Step1 提交注册：201 → 进入 Step2 OTP；409/429/503 分支见 §4.2.1-3 */
export function register(payload: RegisterPayload) {
  return request.post<RegisterResult>('/auth/register', payload)
}

/** Step2 提交验证码：成功返回既有 LoginResult 形态（setToken+setAuth 直接可用） */
export function verifyCode(payload: { email: string; code: string }) {
  return request.post<LoginResult>('/auth/register/verify', payload)
}

/** resend 成功响应（后端 resend 不回 username，signup-billing-onboarding §9.2） */
export interface RegisterResendResult {
  /** 掩码邮箱（a***@domain.com），Step2 展示用 */
  emailMasked: string
  devCode?: string
}

/** Step2 重发验证码（60s 冷却 + 每日上限由服务端 429 把守） */
export function resendCode(payload: { email: string }) {
  return request.post<RegisterResendResult>('/auth/register/resend', payload)
}

export function logout(): void {
  clearToken()
}

export function getCurrentUser() {
  return request.get<{ username: string; name?: string; role?: string }>('/auth/me')
}
