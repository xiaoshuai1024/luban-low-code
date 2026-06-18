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

export interface SavePagePayload {
  name?: string
  path?: string
  schema?: PageSchema
  status?: string
}

export function savePage(siteId: string, pageId: string, data: SavePagePayload) {
  return request.put<PageMeta>(`/sites/${siteId}/pages/${pageId}`, data)
}

/**
 * 发布页面：以 status='published' 保存。
 *
 * 与后端 PUT /sites/:siteId/pages/:pageId 契约一致（savePage 的扩展）。
 * 不在此处假定后端有独立的 publish 端点——统一走 PUT，避免双后端契约分裂。
 */
export function publishPage(siteId: string, pageId: string, data: { name?: string; path?: string; schema?: PageSchema }) {
  return savePage(siteId, pageId, { ...data, status: 'published' })
}

export function deletePage(siteId: string, pageId: string) {
  return request.delete(`/sites/${siteId}/pages/${pageId}`)
}
