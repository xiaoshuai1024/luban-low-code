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

/** Config for an api datasource. The BFF query route reads url/method/headers. */
export interface ApiDatasourceConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'
  headers?: Record<string, string>
}

/** Config for a static datasource (inline rows, no remote). */
export interface StaticDatasourceConfig {
  rows?: unknown[]
}

/** Discriminated config union — replaces the previous Record<string, unknown>,
 * which let callers pass arbitrary shapes the backend would reject. */
export type DatasourceConfig = ApiDatasourceConfig | StaticDatasourceConfig

export interface DatasourceMeta {
  id: string
  siteId: string
  name: string
  type: DatasourceType
  /** Type-narrowed config. For api: {url, method?, headers?}; for static: {rows?}. */
  config?: DatasourceConfig
  createdAt?: string
  updatedAt?: string
}

export interface SaveDatasourcePayload {
  siteId: string
  name: string
  type: DatasourceType
  config?: DatasourceConfig
}

export interface DatasourceTestResult {
  ok: boolean
  message?: string
  latencyMs?: number
}

/** BFF query route returns {data, status} (the upstream response + HTTP status). */
export interface DatasourceQueryResult {
  data: unknown
  status: number
}

/**
 * Normalize a datasource API error into a human-readable message mapped from the
 * backend status code (plan §9.2). Without this the editor silently swallowed
 * axios errors (PageEditor.vue `catch {}` → empty list, no user feedback).
 */
export function normalizeDatasourceError(e: unknown): Error {
  const status =
    e && typeof e === 'object' && 'response' in e
      ? (e as { response?: { status?: number } }).response?.status
      : undefined
  switch (status) {
    case 409:
      return new Error('数据源名称已存在')
    case 404:
      return new Error('数据源不存在')
    case 400:
      return new Error('请求参数无效')
    case 503:
      return new Error('数据源连通性测试失败')
    default:
      return new Error(
        e instanceof Error ? e.message : '数据源请求失败',
      )
  }
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

/**
 * POST /api/datasources/:id/query → 拉取数据源数据（运行时注入表达式上下文）。
 * Optional params are forwarded to the BFF (node.datasource.params).
 */
export function queryDatasource(
  id: string,
  params?: Record<string, unknown>,
) {
  return request.post<DatasourceQueryResult>(
    `/datasources/${id}/query`,
    params ?? {},
  )
}
