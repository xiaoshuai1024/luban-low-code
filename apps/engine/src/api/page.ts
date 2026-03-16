import { request } from './request'
import type { PageSchema } from '@/types/schema'

export interface PageMeta {
  id: string
  siteId: string
  name: string
  path: string
  status?: string
  schema?: PageSchema
  createdAt?: string
  updatedAt?: string
}

export function getPages(siteId: string) {
  return request.get<PageMeta[]>(`/sites/${siteId}/pages`)
}

export function getPage(siteId: string, pageId: string) {
  return request.get<PageMeta>(`/sites/${siteId}/pages/${pageId}`)
}

export function createPage(siteId: string, data: { name: string; path: string; schema?: PageSchema }) {
  return request.post<PageMeta>(`/sites/${siteId}/pages`, data)
}

export function savePage(siteId: string, pageId: string, data: { name?: string; path?: string; schema?: PageSchema }) {
  return request.put<PageMeta>(`/sites/${siteId}/pages/${pageId}`, data)
}

export function deletePage(siteId: string, pageId: string) {
  return request.delete(`/sites/${siteId}/pages/${pageId}`)
}
