import { request } from './request'
import type { PageSchema } from '@/types/schema'

/**
 * V2-T8 版本历史 API 客户端（engine 消费侧）。
 *
 * 契约（与后端一致）：
 *   GET  /sites/:siteId/pages/:pageId/versions → list（不含 schema）
 *   GET  /sites/:siteId/pages/:pageId/versions/:versionId → detail（含 schema）
 *   POST /sites/:siteId/pages/:pageId/versions/:versionId/rollback → 回滚（返回新版本）
 */
export interface PageVersionListItem {
  id: string
  pageId: string
  versionNo: number
  summary?: string
  createdBy?: string
  createdAt?: string
}

export interface PageVersionDetail {
  id: string
  pageId: string
  versionNo: number
  schema?: PageSchema
  summary?: string
  createdBy?: string
  createdAt?: string
}

export function listVersions(siteId: string, pageId: string) {
  return request.get<PageVersionListItem[]>(
    `/sites/${siteId}/pages/${pageId}/versions`
  )
}

export function getVersion(siteId: string, pageId: string, versionId: string) {
  return request.get<PageVersionDetail>(
    `/sites/${siteId}/pages/${pageId}/versions/${versionId}`
  )
}

export function rollbackVersion(siteId: string, pageId: string, versionId: string) {
  return request.post<PageVersionDetail>(
    `/sites/${siteId}/pages/${pageId}/versions/${versionId}/rollback`
  )
}
