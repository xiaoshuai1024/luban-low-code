/**
 * ai.spec.ts — AI 会话状态机 store 单测。
 *
 * 对齐 stores/ai.ts 当前 API（pushUserMessage / consumeEvent / confirmApply /
 * confirmReject / setFailed / clearAll；computed isGenerating / hasPending）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiStore } from '@/stores/ai'
import type { AiSseEvent } from '@/api/ai'

/** 构造一个终态 confirm 事件（带 schema，触发 awaiting_confirm）。 */
function confirmEvent(sessionId = 'sess-1'): AiSseEvent {
  return {
    type: 'confirm',
    session_id: sessionId,
    schema: { root: { id: 'r', type: 'LubanPage', props: {}, children: [] } },
  } as unknown as AiSseEvent
}

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

  it('pushUserMessage 推入用户消息并置 generating', () => {
    const ai = useAiStore()
    ai.pushUserMessage('做一个按钮页')
    expect(ai.status).toBe('generating')
    expect(ai.isGenerating).toBe(true)
    expect(ai.messages).toHaveLength(1)
    expect(ai.messages[0].role).toBe('user')
    expect(ai.messages[0].content).toBe('做一个按钮页')
  })

  it('consumeEvent(confirm) 置 awaiting_confirm + 待确认 schema', () => {
    const ai = useAiStore()
    ai.pushUserMessage('x')
    ai.consumeEvent(confirmEvent('sess-1'))
    expect(ai.status).toBe('awaiting_confirm')
    expect(ai.hasPending).toBe(true)
    expect(ai.pendingSchema).not.toBeNull()
    expect(ai.sessionId).toBe('sess-1')
  })

  it('confirmApply 清空待确认 → applied', () => {
    const ai = useAiStore()
    ai.pushUserMessage('x')
    ai.consumeEvent(confirmEvent())
    ai.confirmApply()
    expect(ai.status).toBe('applied')
    expect(ai.pendingSchema).toBeNull()
  })

  it('confirmReject → rejected', () => {
    const ai = useAiStore()
    ai.pushUserMessage('x')
    ai.consumeEvent(confirmEvent())
    ai.confirmReject()
    expect(ai.status).toBe('rejected')
  })

  it('setFailed 置 error', () => {
    const ai = useAiStore()
    ai.setFailed('校验失败')
    expect(ai.status).toBe('failed')
    expect(ai.error).toBe('校验失败')
  })

  it('clearAll 清空全部', () => {
    const ai = useAiStore()
    ai.pushUserMessage('x')
    ai.consumeEvent(confirmEvent())
    ai.clearAll()
    expect(ai.status).toBe('idle')
    expect(ai.messages).toHaveLength(0)
    expect(ai.pendingSchema).toBeNull()
  })

  it('状态机流转 idle→generating→awaiting_confirm→applied', () => {
    const ai = useAiStore()
    ai.pushUserMessage('x')
    expect(ai.status).toBe('generating')
    ai.consumeEvent(confirmEvent())
    expect(ai.status).toBe('awaiting_confirm')
    ai.confirmApply()
    expect(ai.status).toBe('applied')
  })
})
