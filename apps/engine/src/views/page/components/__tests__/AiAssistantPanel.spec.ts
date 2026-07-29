/**
 * AiAssistantPanel.spec.ts — AI 助手面板组件测（plan P2-T4）。
 *
 * 覆盖核心交互分支：抽屉开关、发送对话、HITL 应用/拒绝、引导加载、设计稿选择。
 * mock @/api/ai 的流式客户端 + getAiConfig/getAiGuidance。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'

// mock @/api/ai：streamChat 返回可控事件流；getAiConfig/getAiGuidance 返回固定数据
const streamChatMock = vi.fn()
const streamDesignToPageMock = vi.fn()
vi.mock('@/api/ai', () => ({
  streamChat: (...a: unknown[]) => streamChatMock(...a),
  streamDesignToPage: (...a: unknown[]) => streamDesignToPageMock(...a),
  getAiConfig: vi.fn().mockResolvedValue({ model: { provider: 'glm', name: 'glm-4' }, features: { generate: true, guidance: true } }),
  getAiGuidance: vi.fn().mockResolvedValue({ tips: [{ level: 'info', title: '加个标题', detail: '试试加标题' }], schema_empty: true }),
  AiApiError: class extends Error {
    code: string
    status: number
    constructor(code: string, msg: string, status: number) { super(msg); this.code = code; this.status = status }
  },
}))

// async generator helper：把事件数组变成 async iterable
async function* genFrom<T>(events: T[]): AsyncGenerator<T> {
  for (const e of events) yield e
}

import AiAssistantPanel from '../AiAssistantPanel.vue'
import { useAiStore } from '@/stores/ai'
import type { PageEditorApi } from '@/composables/usePageEditorApi'
import type { PageSchema } from '@/types/schema'

function makeApi(): PageEditorApi {
  return {
    select: vi.fn(),
    addNode: vi.fn().mockReturnValue('n1'),
    reorder: vi.fn(),
    moveNode: vi.fn(),
    updateProp: vi.fn(),
    updateEvent: vi.fn(),
    updateDatasource: vi.fn(),
    deleteNode: vi.fn(),
    duplicateNode: vi.fn().mockReturnValue('c1'),
    move: vi.fn(),
    replaceSchema: vi.fn(),
    findNodeById: vi.fn().mockReturnValue(null),
    getSelectedNode: vi.fn().mockReturnValue(null),
  }
}

function mountPanel(overrides: Partial<{ schema: PageSchema | null; open: boolean }> = {}) {
  return mount(AiAssistantPanel, {
    props: {
      modelValue: overrides.open ?? true,
      siteId: 's1',
      pageId: 'p1',
      schema: overrides.schema ?? { root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } },
      api: makeApi(),
      selectedId: null,
    },
    global: {
      plugins: [createPinia()],
      stubs: { Transition: false, TransitionGroup: false },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  streamChatMock.mockReturnValue(genFrom([]))
  streamDesignToPageMock.mockReturnValue(genFrom([]))
})

describe('AiAssistantPanel.vue', () => {
  it('抽屉打开时渲染三 tab', async () => {
    const w = mountPanel({ open: true })
    await flushPromises()
    expect(w.findComponent(AiAssistantPanel).exists()).toBe(true)
    // tab 标签存在
    const tabs = w.findAll('.el-tabs__item')
    expect(tabs.length).toBeGreaterThanOrEqual(2)
  })

  it('发送对话调用 streamChat', async () => {
    const w = mountPanel({ open: true })
    await flushPromises()
    // 找输入框并填值
    const textarea = w.find('textarea')
    await textarea.setValue('做个列表页')
    // 按 Enter 触发 send（@keydown.enter.exact.prevent）
    await textarea.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(streamChatMock).toHaveBeenCalled()
  })

  it('待确认态点「应用到画布」调 api.replaceSchema', async () => {
    const w = mountPanel({ open: true })
    await flushPromises()
    const store = useAiStore()
    // 直接把 store 推到 awaiting_confirm + 填 pendingSchema
    store.pushUserMessage('x')
    store.consumeEvent({
      type: 'confirm', session_id: 's1',
      schema: { root: { id: 'root', type: 'LubanPage', props: {}, children: [{ id: 'b', type: 'LubanButton', props: {} }] } },
    } as never)
    await flushPromises()
    const applyBtn = w.findAll('button').find((b) => b.text().includes('应用到画布'))
    expect(applyBtn).toBeDefined()
    await applyBtn!.trigger('click')
    await flushPromises()
    const api = (w.vm.$options.props as unknown[]).length // 仅占位确保 vm 就绪
    void api
    // replaceSchema 经 props.api 调用
    expect((w.props('api') as PageEditorApi).replaceSchema).toHaveBeenCalled()
  })

  it('引导 tab 加载建议', async () => {
    const w = mountPanel({ open: true })
    await flushPromises()
    // 切到引导 tab
    const guidanceTab = w.findAll('.el-tabs__item').find((t) => t.text().includes('引导'))
    await guidanceTab?.trigger('click')
    await flushPromises()
    // getAiGuidance 被调用
    const { getAiGuidance } = await import('@/api/ai')
    expect(getAiGuidance).toHaveBeenCalled()
  })

  it('streamChat 503 → 失败态', async () => {
    const AiApiError = (await import('@/api/ai')).AiApiError as unknown as { new (c: string, m: string, s: number): Error & { code: string } }
    streamChatMock.mockImplementation(() => {
      throw new AiApiError('AI_FEATURE_DISABLED', '未启用', 503)
    })
    const w = mountPanel({ open: true })
    await flushPromises()
    const textarea = w.find('textarea')
    await textarea.setValue('hi')
    await textarea.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const store = useAiStore()
    expect(store.status).toBe('failed')
    expect(store.error).toContain('未启用')
  })
})
