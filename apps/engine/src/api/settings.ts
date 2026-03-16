import { request } from './request'

export interface SystemSettings {
  siteName?: string
  logo?: string
  security?: { sessionTimeout?: number }
  notification?: { enabled?: boolean }
  [key: string]: unknown
}

export function getSettings() {
  return request.get<SystemSettings>('/settings')
}

export function updateSettings(data: Partial<SystemSettings>) {
  return request.put<SystemSettings>('/settings', data)
}
