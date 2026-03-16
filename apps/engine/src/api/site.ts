import { request } from './request'

export interface Site {
  id: string
  name: string
  slug?: string
  baseUrl?: string
  status?: string
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
