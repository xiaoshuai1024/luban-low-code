import { request } from './request'

/**
 * Datasource API client. Mirrors src/api/page.ts conventions:
 *   - import the shared axios `request` instance (no new http wrapper)
 *   - types inlined here (not in src/types/, unless shared with low-code)
 *   - errors are transparent — axios error bubbles up, 401 auto-handled by the
 *     interceptor in request.ts
 *   - no src/api/index.ts re-export (each module is imported directly)
 *
 * URL shape follows the backend contract (plan §9.2), which is a top-level
 * /datasources resource (NOT nested under /sites/:siteId like pages). The list is
 * multi-tenant-filtered by a `siteId` query param.
 */

/** Allowed datasource types — keep in sync with the backend whitelist
 * (Java DatasourceService.ALLOWED_TYPES / Go service.AllowedTypes). The backend
 * is the source of truth; this is a TS hint for editor forms. */
export type DatasourceType = 'static' | 'api'

export interface DatasourceMeta {
  id: string
  siteId: string
  name: string
  type: DatasourceType
  /** Free-form config object. For api: {url, method?, headers?}; for static: {rows?}. */
  config?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface SaveDatasourcePayload {
  siteId: string
  name: string
  type: DatasourceType
  config?: Record<string, unknown>
}

export interface DatasourceTestResult {
  ok: boolean
  message?: string
  latencyMs?: number
}

/** GET /api/datasources?siteId= → list (filtered by site, multi-tenant isolated). */
export function getDatasources(siteId: string) {
  return request.get<DatasourceMeta[]>('/datasources', {
    params: { siteId },
  })
}

/** GET /api/datasources/:id → single datasource. */
export function getDatasource(id: string) {
  return request.get<DatasourceMeta>(`/datasources/${id}`)
}

/** POST /api/datasources → 201 created | 409 NAME_CONFLICT | 404 SITE_NOT_FOUND | 400. */
export function createDatasource(data: SaveDatasourcePayload) {
  return request.post<DatasourceMeta>('/datasources', data)
}

/** PUT /api/datasources/:id → 200 | 404 | 409. */
export function updateDatasource(id: string, data: SaveDatasourcePayload) {
  return request.put<DatasourceMeta>(`/datasources/${id}`, data)
}

/** DELETE /api/datasources/:id → 204 | 404. */
export function deleteDatasource(id: string) {
  return request.delete<void>(`/datasources/${id}`)
}

/**
 * POST /api/datasources/:id/test → 200 {ok,message,latencyMs} | 503.
 *
 * Probes the configured datasource. For static datasources the backend returns
 * ok=true with latency 0 (no remote); for api datasources it issues an HTTP GET
 * against config.url. The BFF/backend enforces the type whitelist and any SSRF
 * guards — the engine just reports the result.
 */
export function testDatasource(id: string) {
  return request.post<DatasourceTestResult>(`/datasources/${id}/test`)
}
