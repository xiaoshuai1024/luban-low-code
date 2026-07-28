/**
 * ai.spec.ts — AI 会话状态机 store 单测。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiStore } from '@/stores/ai'

describe('useAiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始 idle', () => {
    const ai = useAiStore()
    expect(ai.status).toBe('idle')
    expect(ai.messages).toHaveLength(0)
    expect(ai.isGenerating).toBe(false)
  })

  it('startGenerating 推入用户消息并置 generating', () => {
    const ai = useAiStore()
    ai.startGenerating('做一个按钮页')
    expect(ai.status).toBe('generating')
    expect(ai.isGenerating).toBe(true)
    expect(ai.messages).toHaveLength(1)
    expect(ai.messages[0].role).toBe('user')
    expect(ai.messages[0].text).toBe('做一个按钮页')
  })

  it('pushAiMessage 推 AI 消息', () => {
    const ai = useAiStore()
    ai.pushAiMessage({ kind: 'progress', text: '检索物料…' })
    expect(ai.messages).toHaveLength(1)
    expect(ai.messages[0].role).toBe('ai')
  })

  it('setConfirm 置 awaiting_confirm + 待确认 schema', () => {
    const ai = useAiStore()
    const schema = { root: { id: 'r', type: 'LubanPage', props: {}, children: [] } }
    ai.setConfirm(schema, 'sess-1')
    expect(ai.status).toBe('awaiting_confirm')
    expect(ai.isAwaitingConfirm).toBe(true)
    expect(ai.pendingSchema).toStrictEqual(schema)
    expect(ai.pendingSessionId).toBe('sess-1')
  })

  it('markApplied 清空待确认', () => {
    const ai = useAiStore()
    ai.setConfirm({ root: { id: 'r', type: 'LubanPage', props: {}, children: [] } }, 's')
    ai.markApplied()
    expect(ai.status).toBe('applied')
    expect(ai.pendingSchema).toBeNull()
  })

  it('markRejected', () => {
    const ai = useAiStore()
    ai.setConfirm({ root: { id: 'r', type: 'LubanPage', props: {}, children: [] } }, 's')
    ai.markRejected()
    expect(ai.status).toBe('rejected')
  })

  it('markFailed 置 error', () => {
    const ai = useAiStore()
    ai.markFailed('校验失败')
    expect(ai.status).toBe('failed')
    expect(ai.error).toBe('校验失败')
  })

  it('reset 清空', () => {
    const ai = useAiStore()
    ai.startGenerating('x')
    ai.pushAiMessage({ kind: 'progress', text: 'y' })
    ai.reset()
    expect(ai.status).toBe('idle')
    expect(ai.messages).toHaveLength(0)
  })

  it('状态机流转 idle→generating→awaiting_confirm→applied', () => {
    const ai = useAiStore()
    ai.startGenerating('x')
    expect(ai.status).toBe('generating')
    ai.setConfirm({ root: { id: 'r', type: 'LubanPage', props: {}, children: [] } }, 's')
    expect(ai.status).toBe('awaiting_confirm')
    ai.markApplied()
    expect(ai.status).toBe('applied')
  })
})
