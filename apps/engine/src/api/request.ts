import axios, { type AxiosInstance } from 'axios'

const TOKEN_KEY = 'luban_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export const request: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      const path = window.location.pathname
      if (!path.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

/** BFF/Java 错误体归一结果（signup-billing-onboarding §9.5）。 */
export interface ApiError {
  /** SCREAMING_SNAKE 业务错误码，如 USERNAME_TAKEN / RATE_LIMITED */
  code?: string
  message: string
  /** 错误详情，如 VERIFY_CODE_INVALID 的 {remainingAttempts} */
  details?: Record<string, unknown>
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 从任意抛出的错误中提取 BFF/Java 错误体（{code,message,details?}）。
 *
 * - axios 错误且有可用响应体：取响应体的 code/message/details（字段级内联错误依赖 code）；
 * - 响应体有 code 但 message 为空：保留 code 供调用方分支，文案兜底中文；
 * - 网络错误/超时/无响应体：友好中文文案，不透出 axios 英文原文；
 * - 非 axios 错误：回落 Error.message，保证调用方总有可展示文案。
 */
export function extractApiError(e: unknown): ApiError {
  if (axios.isAxiosError(e)) {
    const body = e.response?.data
    if (isRecord(body)) {
      const message = typeof body.message === 'string' && body.message ? body.message : ''
      if (message) {
        return {
          code: typeof body.code === 'string' ? body.code : undefined,
          message,
          details: isRecord(body.details) ? body.details : undefined,
        }
      }
      // 有 code 无 message：仍回传 code（调用方按 code 分支），文案兜底中文
      if (typeof body.code === 'string' && body.code) {
        return { code: body.code, message: '请求失败，请稍后重试' }
      }
    }
    return { message: '网络异常，请检查连接后重试' }
  }
  if (e instanceof Error && e.message) {
    return { message: e.message }
  }
  return { message: '请求失败' }
}
