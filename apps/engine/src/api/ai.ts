/**
 * api/ai.ts — AI 服务客户端（plan P1-T8 通信层 / P2-T4 设计稿扩展）。
 *
 * 对接 luban-ai-assistant（FastAPI，端口 8000）：
 *   - POST /ai/chat        SSE 流式对话生成/编辑
 *   - POST /ai/generate    SSE 流式生成（受 ai.generate FeatureGate 控制，关→503）
 *   - POST /ai/design-to-page  multipart SSE 设计稿转页面（plan P2-T3）
 *   - GET  /ai/config      只读模型配置
 *   - GET  /healthz        健康检查
 *
 * 鉴权：复用 luban JWT（localStorage `luban_token`）作 Authorization: Bearer。
 * AI 服务读同一 AUTH_JWT_SECRET 验签（app/auth/jwt.py）。
 *
 * 技术选型：fetch + ReadableStream（非 EventSource）。
 *   原因：① POST + body（messages 大）EventSource 不支持；② Bearer 自定义 header
 *   EventSource 不支持（仅 cookie/query）。见调研报告。
 *
 * SSE 帧解析：sse-starlette EventSourceResponse 每帧为
 *   `event: <type>\ndata: <json>\n\n`。type 即 data.type（progress/tool/intent/warning/
 *   confirm/error/done）。关键坑：`confirm` 会流两遍 —— hitl 节点一条（有 ts 无 schema）
 *   + 终态一条（有 schema 无 ts），用 data.schema 是否存在区分（见 AiSseEvent 注释）。
 */
import { getToken, clearToken } from './request'
import type { PageSchema } from '@/types/schema'

/** AI 服务基址：默认走 vite proxy `/ai`（→ :8000）；可经 VITE_AI_BASE_URL 直连。 */
const AI_BASE_URL = (import.meta.env.VITE_AI_BASE_URL as string | undefined) ?? '/ai'

/** AI 服务会话状态（对齐 app/agent/state.py SessionStatus）。 */
export type AiSessionStatus =
  | 'idle'
  | 'generating'
  | 'awaiting_confirm'
  | 'applied'
  | 'rejected'
  | 'failed'

// === 请求体 ===
export interface ChatRequest {
  siteId?: string
  pageId?: string
  message: string
  context?: Record<string, unknown> // { currentSchema? }
}

export interface GenerateRequest {
  siteId?: string
  pageId?: string
  prompt: string
  context?: Record<string, unknown>
}

// === SSE 事件载荷（data 字段反序列化）===
// 注意：各节点 payload 字段不同，非通用字段统一可选。
export interface ProgressEvent {
  type: 'progress'
  ts: number
  message: string
}
export interface ToolEvent {
  type: 'tool'
  ts: number
  tool: string
  result?: string
  materials?: string[]
  ok?: boolean
  error?: string
  retry?: number
}
export interface IntentEvent {
  type: 'intent'
  ts: number
  kind: string // generate_page | edit_property | guidance | unknown
  summary: string
}
export interface WarningEvent {
  type: 'warning'
  ts: number
  missing_materials: string[]
}
/** hitl 节点流出的 confirm（有 ts 无 schema）。 */
export interface ConfirmStreamEvent {
  type: 'confirm'
  ts: number
  message?: string
  schema?: undefined
}
/** 终态 confirm（有 schema 无 ts）—— 待用户 HITL 确认。 */
export interface ConfirmTerminalEvent {
  type: 'confirm'
  session_id: string
  schema: PageSchema | null
}
export interface ErrorEvent {
  type: 'error'
  message: string
}
export interface DoneEvent {
  type: 'done'
  status: AiSessionStatus
}

export type AiSseEvent =
  | ProgressEvent
  | ToolEvent
  | IntentEvent
  | WarningEvent
  | ConfirmStreamEvent
  | ConfirmTerminalEvent
  | ErrorEvent
  | DoneEvent

/** 终态 confirm 判定：data 带 schema 字段（hitl 流出那条无 schema）。 */
export function isTerminalConfirm(ev: AiSseEvent): ev is ConfirmTerminalEvent {
  return ev.type === 'confirm' && 'schema' in ev && ev.schema !== undefined
}

// === /ai/config ===
export interface AiConfig {
  model: { provider: string; name: string }
  features: { generate: boolean; guidance: boolean; design_to_page?: boolean }
}

// === /healthz ===
export interface AiHealth {
  status: 'ok' | 'degraded'
  deps: { postgres: boolean; milvus: boolean; minio: boolean; langfuse: boolean }
}

/** 构造鉴权头（复用 luban JWT，与 request.ts 拦截器同源）。 */
function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * SSE 流式请求。返回事件 async generator，调用方 for-await 消费。
 * 401 → clearToken + 跳 /login（复刻 request.ts:36-42 行为）。
 * @param path   端点路径（如 '/chat'）
 * @param body   JSON body
 * @param signal 可选 AbortSignal（面板卸载/切换时中止）
 */
export async function* streamAi(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<AiSseEvent, void, unknown> {
  const res = await fetch(`${AI_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  })

  if (res.status === 401) {
    clearToken()
    const p = window.location.pathname
    if (!p.startsWith('/login')) window.location.href = '/login'
    throw new AiApiError('UNAUTHENTICATED', '未登录或登录已过期', 401)
  }
  if (res.status === 503) {
    throw new AiApiError('AI_FEATURE_DISABLED', 'AI 功能未启用', 503)
  }
  if (!res.ok) {
    // 尝试解析错误体 {code, message, details?}
    const err = await parseErrorBody(res)
    throw err
  }
  if (!res.body) throw new AiApiError('AI_GENERATION_FAILED', '无响应流', res.status)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE 帧以 \n\n 分隔
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const ev = parseSseFrame(frame)
        if (ev) yield ev
      }
    }
    // flush 残余
    if (buffer.trim()) {
      const ev = parseSseFrame(buffer)
      if (ev) yield ev
    }
  } finally {
    reader.releaseLock()
  }
}

/** 解析单个 SSE 帧（`event: x\ndata: {...}`）为 AiSseEvent。 */
export function parseSseFrame(frame: string): AiSseEvent | null {
  const lines = frame.split('\n')
  let dataStr = ''
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataStr += line.slice(5).trim()
    }
    // event: 行用于 sse-starlette 内部，data.type 已含类型，此处忽略 event: 行
  }
  if (!dataStr) return null
  try {
    return JSON.parse(dataStr) as AiSseEvent
  } catch {
    return null
  }
}

async function parseErrorBody(res: Response): Promise<AiApiError> {
  try {
    const body = (await res.json()) as { code?: string; message?: string; details?: unknown }
    return new AiApiError(body.code ?? 'AI_GENERATION_FAILED', body.message ?? `请求失败 ${res.status}`, res.status, body.details)
  } catch {
    return new AiApiError('AI_GENERATION_FAILED', `请求失败 ${res.status}`, res.status)
  }
}

/** AI 服务错误（对齐 app/api/errors.py code 枚举）。 */
export class AiApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'AiApiError'
  }
}

/** POST /ai/chat —— 对话生成/编辑页面（SSE 流式）。 */
export function streamChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<AiSseEvent> {
  return streamAi('/chat', req as unknown as Record<string, unknown>, signal)
}

/** POST /ai/generate —— 生成页面（SSE 流式，受 ai.generate FeatureGate 控制）。 */
export function streamGenerate(req: GenerateRequest, signal?: AbortSignal): AsyncGenerator<AiSseEvent> {
  return streamAi('/generate', req as unknown as Record<string, unknown>, signal)
}

/** GET /ai/config —— 只读模型配置。 */
export async function getAiConfig(): Promise<AiConfig> {
  const res = await fetch(`${AI_BASE_URL}/config`, { headers: authHeaders() })
  if (!res.ok) throw new AiApiError('AI_GENERATION_FAILED', `配置获取失败 ${res.status}`, res.status)
  return (await res.json()) as AiConfig
}

/** 引导建议（GET /ai/guidance，对齐 app/api/guidance.py GuidanceResponse）。 */
export interface AiGuidanceTip {
  level: 'info' | 'warn' | 'block' | string
  title: string
  detail: string
  action?: string
}
export interface AiGuidanceResponse {
  tips: AiGuidanceTip[]
  schema_empty: boolean
}

/** GET /ai/guidance —— 读当前 schema 给下一步建议（规则化，受 ai.guidance FeatureGate 控制）。 */
export async function getAiGuidance(empty = true): Promise<AiGuidanceResponse> {
  const res = await fetch(`${AI_BASE_URL}/guidance?empty=${empty ? 'true' : 'false'}`, {
    headers: authHeaders(),
  })
  if (res.status === 503) throw new AiApiError('AI_FEATURE_DISABLED', '引导功能未启用', 503)
  if (res.status === 401) {
    clearToken()
    const p = window.location.pathname
    if (!p.startsWith('/login')) window.location.href = '/login'
    throw new AiApiError('UNAUTHENTICATED', '未登录或登录已过期', 401)
  }
  if (!res.ok) throw new AiApiError('AI_GENERATION_FAILED', `引导获取失败 ${res.status}`, res.status)
  return (await res.json()) as AiGuidanceResponse
}

/** GET /healthz —— 健康检查（无鉴权）。 */
export async function getAiHealth(): Promise<AiHealth> {
  const res = await fetch(`${AI_BASE_URL.replace(/\/ai$/, '')}/healthz`)
  if (!res.ok) throw new AiApiError('AI_GENERATION_FAILED', `健康检查失败 ${res.status}`, res.status)
  return (await res.json()) as AiHealth
}

/**
 * POST /ai/design-to-page —— 设计稿转页面（multipart + SSE，plan P2-T3）。
 * 图片以 multipart/form-data 上传，响应为 SSE 流（uploaded/understanding/generating/patch/confirm/done/error）。
 */
export async function* streamDesignToPage(
  params: { image: File; siteId?: string; pageId?: string; context?: Record<string, unknown> },
  signal?: AbortSignal,
): AsyncGenerator<AiSseEvent> {
  const form = new FormData()
  form.append('image', params.image)
  if (params.siteId) form.append('siteId', params.siteId)
  if (params.pageId) form.append('pageId', params.pageId)
  if (params.context) form.append('context', JSON.stringify(params.context))

  const res = await fetch(`${AI_BASE_URL}/design-to-page`, {
    method: 'POST',
    headers: { Accept: 'text/event-stream', ...authHeaders() },
    body: form,
    signal,
  })
  if (res.status === 401) {
    clearToken()
    const p = window.location.pathname
    if (!p.startsWith('/login')) window.location.href = '/login'
    throw new AiApiError('UNAUTHENTICATED', '未登录或登录已过期', 401)
  }
  if (res.status === 503) throw new AiApiError('AI_FEATURE_DISABLED', '设计稿功能未启用', 503)
  if (res.status === 400) {
    const err = await parseErrorBody(res)
    throw err
  }
  if (!res.ok) throw new AiApiError('AI_GENERATION_FAILED', `设计稿请求失败 ${res.status}`, res.status)
  if (!res.body) throw new AiApiError('AI_GENERATION_FAILED', '无响应流', res.status)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const ev = parseSseFrame(frame)
        if (ev) yield ev
      }
    }
    if (buffer.trim()) {
      const ev = parseSseFrame(buffer)
      if (ev) yield ev
    }
  } finally {
    reader.releaseLock()
  }
}
