/**
 * ai.spec.ts — AI 服务客户端单测（mock fetch + localStorage）。
 *
 * 覆盖（合并原 src/api/ai.spec.ts 的独有断言，原双份 spec 已收敛到本文件）：
 *  - getAiConfig / streamAi：Bearer 头、无 token、for-await 事件解析、AbortSignal
 *  - parseSseFrame：SSE 帧解析（data 行拼接、event 行忽略、坏 JSON 返回 null）
 *  - isTerminalConfirm：终态 confirm 判定（有 schema vs 流式 confirm）
 *  - AiApiError：错误码/状态码/details
 *  - streamChat/streamDesignToPage：401/503/400 错误路径、跨帧半包拼接、multipart 上传
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getAiConfig,
  streamAi,
  parseSseFrame,
  isTerminalConfirm,
  AiApiError,
  streamChat,
  streamDesignToPage,
} from '@/api/ai'
import type { AiConfig, AiSseEvent } from '@/api/ai'

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

function makeSseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } })
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

describe('parseSseFrame', () => {
  it('解析单行 data 帧为事件', () => {
    const frame = 'event: progress\ndata: {"type":"progress","ts":1,"message":"hi"}'
    const ev = parseSseFrame(frame)
    expect(ev?.type).toBe('progress')
  })

  it('多行 data 拼接（SSE 允许 data 跨行）', () => {
    const frame = 'data: {"type":"done",\ndata: "status":"applied"}'
    const ev = parseSseFrame(frame)
    expect(ev?.type).toBe('done')
  })

  it('忽略 event 行，以 data.type 为准', () => {
    const frame = 'event: foo\ndata: {"type":"error","message":"x"}'
    const ev = parseSseFrame(frame)
    expect(ev?.type).toBe('error')
  })

  it('无 data 行返回 null', () => {
    expect(parseSseFrame('event: only')).toBeNull()
  })

  it('坏 JSON 返回 null（不抛）', () => {
    expect(parseSseFrame('data: {not json')).toBeNull()
  })
})

describe('isTerminalConfirm', () => {
  it('带 schema 的 confirm 是终态', () => {
    const ev = { type: 'confirm', session_id: 's1', schema: { root: { id: 'r', type: 'LubanPage' } } } as unknown as AiSseEvent
    expect(isTerminalConfirm(ev)).toBe(true)
  })

  it('带 ts 无 schema 的 confirm 非终态（hitl 流式）', () => {
    const ev = { type: 'confirm', ts: 1, message: '等待确认' } as unknown as AiSseEvent
    expect(isTerminalConfirm(ev)).toBe(false)
  })

  it('schema 为 null 的终态 confirm：null !== undefined → 判定为终态（边界：无产物但已达确认阶段）', () => {
    // isTerminalConfirm 用 schema !== undefined 判定；null 通过该判断（语义：到达确认阶段但无产物）
    const ev = { type: 'confirm', session_id: 's1', schema: null } as unknown as AiSseEvent
    expect(isTerminalConfirm(ev)).toBe(true)
  })

  it('非 confirm 事件返回 false', () => {
    const ev = { type: 'progress', ts: 1, message: 'x' } as unknown as AiSseEvent
    expect(isTerminalConfirm(ev)).toBe(false)
  })
})

describe('AiApiError', () => {
  it('携带 code/status/details', () => {
    const err = new AiApiError('AI_FEATURE_DISABLED', '未启用', 503, { k: 'v' })
    expect(err.code).toBe('AI_FEATURE_DISABLED')
    expect(err.status).toBe(503)
    expect(err.message).toBe('未启用')
    expect(err.details).toEqual({ k: 'v' })
    expect(err.name).toBe('AiApiError')
  })
})

describe('streamChat', () => {
  beforeEach(() => {
    store.luban_token = 'test-jwt'
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    Object.keys(store).forEach((k) => delete store[k])
  })

  it('带 Authorization Bearer 头（从 localStorage luban_token）', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(makeSseResponse(['data: {"type":"done","status":"applied"}\n\n']))
    const events = []
    for await (const ev of streamChat({ message: 'hi' })) events.push(ev)
    expect(fetchMock).toHaveBeenCalledOnce()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-jwt')
  })

  it('解析多个 SSE 事件', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([
        'data: {"type":"progress","ts":1,"message":"a"}\n\n',
        'data: {"type":"done","status":"applied"}\n\n',
      ]),
    )
    const events = []
    for await (const ev of streamChat({ message: 'hi' })) events.push(ev)
    expect(events.map((e) => e.type)).toEqual(['progress', 'done'])
  })

  it('401 → 抛 UNAUTHENTICATED 并清 token', async () => {
    store.luban_token = 'x'
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 401 }))
    await expect(async () => {
      for await (const _e of streamChat({ message: 'hi' })) { /* drain */ }
    }).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(localStorage.getItem('luban_token')).toBeNull()
  })

  it('503 → 抛 AI_FEATURE_DISABLED', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }))
    await expect(async () => {
      for await (const _e of streamChat({ message: 'hi' })) { /* drain */ }
    }).rejects.toMatchObject({ code: 'AI_FEATURE_DISABLED' })
  })

  it('跨帧半包拼接（一个事件被分到两个 chunk）', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([
        'data: {"type":"prog',
        'ress","ts":1,"message":"x"}\n\n',
      ]),
    )
    const events = []
    for await (const ev of streamChat({ message: 'hi' })) events.push(ev)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('progress')
  })
})

describe('streamDesignToPage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('用 multipart 上传（FormData 含 image）', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(makeSseResponse(['data: {"type":"done","status":"applied"}\n\n']))
    const file = new File(['png'], 'd.png', { type: 'image/png' })
    const events = []
    for await (const ev of streamDesignToPage({ image: file, siteId: 's1' })) events.push(ev)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('image')).toBe(file)
  })

  it('400 → 抛错误（INVALID_IMAGE 等）', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 'INVALID_IMAGE', message: '坏图' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const file = new File(['x'], 'd.png', { type: 'image/png' })
    await expect(async () => {
      for await (const _e of streamDesignToPage({ image: file })) { /* drain */ }
    }).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
  })
})
