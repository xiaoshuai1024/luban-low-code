import { request, clearToken } from './request'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user?: { id: string; username: string; name?: string; role?: string }
}

export function login(payload: LoginPayload) {
  return request.post<LoginResult>('/auth/login', payload)
}

export function logout(): void {
  clearToken()
}

export function getCurrentUser() {
  return request.get<{ id: string; username: string; name?: string; role?: string }>('/auth/me')
}
