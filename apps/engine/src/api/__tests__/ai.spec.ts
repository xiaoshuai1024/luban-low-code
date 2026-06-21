/**
 * ai.spec.ts — AI 服务客户端单测（mock fetch + localStorage）。
 *
 * 验证：getAiConfig、streamAi 的 SSE 解析、鉴权 Bearer 头、事件路由。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAiConfig, streamAi } from '@/api/ai'
import type { AiConfig } from '@/api/ai'

// mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
vi.stubGlobal('localStorage', localStorageMock)

function mockFetchResponse(body: string, ok = true, status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })
  return {
    ok,
    status,
    body: stream,
    json: async () => JSON.parse(body),
  } as unknown as Response
}

describe('ai client', () => {
  beforeEach(() => {
    store.luban_token = 'test-jwt'
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    Object.keys(store).forEach((k) => delete store[k])
  })

  it('getAiConfig 带 Bearer 头', async () => {
    const cfg: AiConfig = { model: { provider: 'glm', name: 'glm-4' }, features: { generate: true, guidance: true } }
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(JSON.stringify(cfg))
    )
    const result = await getAiConfig()
    expect(result.model.provider).toBe('glm')
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].headers.Authorization).toBe('Bearer test-jwt')
  })

  it('getAiConfig 无 token 不带 Authorization', async () => {
    delete store.luban_token
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(JSON.stringify({ model: { provider: 'glm', name: 'glm-4' }, features: { generate: true, guidance: true } }))
    )
    await getAiConfig()
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].headers.Authorization).toBeUndefined()
  })

  it('streamAi 解析 SSE confirm 事件', async () => {
    const sseBody = 'event: progress\ndata: {"type":"progress","message":"生成中"}\n\n' +
      'event: confirm\ndata: {"type":"confirm","session_id":"s1","schema":{"root":{"id":"r","type":"LubanPage","props":{},"children":[]}}}\n\n'
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(sseBody)
    )
    const events: unknown[] = []
    await new Promise<void>((resolve) => {
      streamAi('/ai/chat', { message: 'x' }, {
        onProgress: (e) => events.push({ progress: e }),
        onConfirm: (e) => { events.push({ confirm: e }); resolve() },
      })
    })
    expect(events.some((e) => (e as { confirm?: unknown }).confirm)).toBe(true)
  })

  it('streamAi error 事件触发 onError', async () => {
    const sseBody = 'event: error\ndata: {"type":"error","message":"生成失败"}\n\n'
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(sseBody)
    )
    const err = await new Promise<string>((resolve) => {
      streamAi('/ai/chat', { message: 'x' }, {
        onError: (e) => resolve(e.message),
      })
    })
    expect(err).toBe('生成失败')
  })

  it('streamAi 返回 AbortController', () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse('')
    )
    const ctrl = streamAi('/ai/chat', { message: 'x' }, {})
    expect(ctrl).toBeInstanceOf(AbortController)
    ctrl.abort()
  })
})
