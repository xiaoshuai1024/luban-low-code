import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { setupMock } from '../mocks'

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

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

if (useMock) {
  setupMock(request)
}

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
    // 来自 mock 拦截器的“错误”，直接作为成功响应返回
    if (error && (error as { __isMock?: boolean }).__isMock && (error as { response?: AxiosResponse }).response) {
      return Promise.resolve((error as { response: AxiosResponse }).response)
    }
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
