import { request } from './request'

/**
 * V2-T10 站点级分析埋点配置。
 * 各平台可选；website SSR 据此注入第三方 SDK 脚本。
 */
export interface SiteAnalytics {
  /** Google Analytics 4 */
  ga4?: { measurementId: string }
  /** 百度统计 */
  baidu?: { id: string }
  /** Facebook Pixel */
  facebook?: { pixelId: string }
}

export interface Site {
  id: string
  name: string
  slug?: string
  baseUrl?: string
  status?: string
  /** V2-T2 站点级 SEO */
  seo?: Record<string, unknown>
  /** V2-T10 站点级分析埋点 */
  analytics?: SiteAnalytics
  createdAt?: string
  updatedAt?: string
}

export function getSites() {
  return request.get<Site[]>('/sites')
}

export function getSite(id: string) {
  return request.get<Site>(`/sites/${id}`)
}

export function createSite(data: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>) {
  return request.post<Site>('/sites', data)
}

export function updateSite(id: string, data: Partial<Site>) {
  return request.put<Site>(`/sites/${id}`, data)
}

export function deleteSite(id: string) {
  return request.delete(`/sites/${id}`)
}
