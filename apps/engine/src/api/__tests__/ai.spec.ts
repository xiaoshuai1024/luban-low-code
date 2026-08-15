/**
 * ai.spec.ts — AI 服务客户端单测（mock fetch + localStorage）。
 *
 * 适配新 API：streamAi(path, body, signal?) 返回 AsyncGenerator<AiSseEvent>，
 * 调用方 for-await 消费事件（progress/confirm/error/done）。
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
  return { ok, status, body: stream, json: async () => JSON.parse(body) } as unknown as Response
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
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchResponse(JSON.stringify(cfg)))
    const result = await getAiConfig()
    expect(result.model.provider).toBe('glm')
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].headers.Authorization).toBe('Bearer test-jwt')
  })

  it('getAiConfig 无 token 不带 Authorization', async () => {
    delete store.luban_token
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse(JSON.stringify({ model: { provider: 'glm', name: 'glm-4' }, features: { generate: true, guidance: true } })),
    )
    await getAiConfig()
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].headers.Authorization).toBeUndefined()
  })

  it('streamAi for-await 解析 SSE 事件（progress + 终态 confirm）', async () => {
    const sseBody =
      'data: {"type":"progress","ts":1,"message":"生成中"}\n\n' +
      'data: {"type":"confirm","session_id":"s1","schema":{"root":{"id":"r","type":"LubanPage","props":{},"children":[]}}}\n\n'
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchResponse(sseBody))
    const events: { type: string }[] = []
    for await (const ev of streamAi('/chat', { message: 'x' })) {
      events.push(ev as { type: string })
    }
    expect(events.some((e) => e.type === 'progress')).toBe(true)
    expect(events.some((e) => e.type === 'confirm')).toBe(true)
  })

  it('streamAi for-await 解析 error 事件', async () => {
    const sseBody = 'data: {"type":"error","message":"生成失败"}\n\n'
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchResponse(sseBody))
    const events: { type: string; message?: string }[] = []
    for await (const ev of streamAi('/chat', { message: 'x' })) {
      events.push(ev as { type: string; message?: string })
    }
    expect(events.some((e) => e.type === 'error' && e.message === '生成失败')).toBe(true)
  })

  it('streamAi 接受 AbortSignal（第 3 参数）并返回 async generator', () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchResponse(''))
    const ctrl = new AbortController()
    const gen = streamAi('/chat', { message: 'x' }, ctrl.signal)
    expect(typeof gen.next).toBe('function') // AsyncGenerator
    expect(typeof gen[Symbol.asyncIterator]).toBe('function')
    ctrl.abort()
  })
})
