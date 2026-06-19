/**
 * ai.ts — AI 助手服务客户端（SSE + 配置 + WS）。
 *
 * 直连 AI 服务（plan §6.1 边界：前端直连 AI 服务，不动 BFF 流式）。
 * 鉴权：复用 luban JWT（localStorage luban_token），Bearer 头。
 *
 * SSE 不用 EventSource（不支持自定义 Header），用 fetch + ReadableStream 解析
 * text/event-stream。WS 用 query param 传 token（WS 不便加 Header）。
 *
 * AI 服务地址由 import.meta.env.VITE_AI_API_BASE_URL 配置（默认 /ai-proxy，
 * vite.config dev 代理到 http://localhost:8000）。
 */
import type { PageSchema } from '@/types/schema'

const AI_BASE = (import.meta.env.VITE_AI_API_BASE_URL as string | undefined) ?? '/ai-proxy'

const TOKEN_KEY = 'luban_token'
function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export interface AiConfig {
  model: { provider: string; name: string }
  features: { generate: boolean; guidance: boolean }
}

export interface AiProgressEvent {
  type: string
  [k: string]: unknown
}

export interface AiConfirmEvent {
  type: 'confirm'
  session_id: string
  schema: PageSchema | null
}

export interface AiErrorEvent {
  type: 'error'
  message: string
}

export interface AiChatHandlers {
  onProgress?: (ev: AiProgressEvent) => void
  onConfirm?: (ev: AiConfirmEvent) => void
  onError?: (ev: AiErrorEvent) => void
  onDone?: (ev: { type: 'done'; status: string }) => void
}

export async function getAiConfig(): Promise<AiConfig> {
  const token = getToken()
  const resp = await fetch(`${AI_BASE}/ai/config`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) throw new Error(`AI 配置获取失败: ${resp.status}`)
  return resp.json()
}

/**
 * 流式发起对话/生成（SSE POST）。
 * endpoint: '/ai/chat' | '/ai/generate'
 * 返回 AbortController（可取消）。
 */
export function streamAi(
  endpoint: '/ai/chat' | '/ai/generate',
  payload: { siteId?: string; pageId?: string; message?: string; prompt?: string },
  handlers: AiChatHandlers,
  signal?: AbortSignal
): AbortController {
  const ctrl = new AbortController()
  if (signal) signal.addEventListener('abort', () => ctrl.abort())

  const token = getToken()
  const body = endpoint === '/ai/chat'
    ? { siteId: payload.siteId, pageId: payload.pageId, message: payload.message }
    : { siteId: payload.siteId, pageId: payload.pageId, prompt: payload.prompt }

  ;(async () => {
    try {
      const resp = await fetch(`${AI_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      if (!resp.ok || !resp.body) {
        throw new Error(`AI 请求失败: ${resp.status}`)
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let curEvent = 'message'
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // SSE 帧以 \n\n 分隔
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) {
              curEvent = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              const raw = line.slice(5).trim()
              try {
                const data = JSON.parse(raw)
                routeEvent(curEvent, data, handlers)
              } catch {
                /* 忽略非 JSON data 行 */
              }
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      handlers.onError?.({ type: 'error', message: (e as Error).message })
    }
  })()

  return ctrl
}

function routeEvent(event: string, data: unknown, h: AiChatHandlers): void {
  const d = data as Record<string, unknown>
  const type = (d.type as string) ?? event
  if (type === 'confirm') {
    h.onConfirm?.({ type: 'confirm', session_id: String(d.session_id ?? ''), schema: (d.schema as PageSchema) ?? null })
  } else if (type === 'error') {
    h.onError?.({ type: 'error', message: String(d.message ?? '未知错误') })
  } else if (type === 'done') {
    h.onDone?.({ type: 'done', status: String(d.status ?? 'done') })
  } else {
    h.onProgress?.({ type, ...d })
  }
}
