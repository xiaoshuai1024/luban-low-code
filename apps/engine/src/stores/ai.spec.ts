/**
 * stores/ai.spec.ts — AI 会话状态机单测（plan P2-T4）。
 *
 * 覆盖状态迁移：idle → generating → awaiting_confirm → applied/rejected/failed。
 * consumeEvent 各事件类型、confirm 流式 vs 终态区分、HITL 确认/拒绝、失败/清空。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiStore } from './ai'
import type { AiSseEvent } from '@/api/ai'

beforeEach(() => {
  setActivePinia(createPinia())
})

function ev(partial: Partial<AiSseEvent> & { type: string }): AiSseEvent {
  return partial as unknown as AiSseEvent
}

describe('useAiStore 状态机', () => {
  it('pushUserMessage 进入 generating + 累积消息', () => {
    const store = useAiStore()
    store.pushUserMessage('做个列表页')
    expect(store.status).toBe('generating')
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].role).toBe('user')
  })

  it('consumeEvent progress/tool/intent/warning 累积到 pendingSteps，非终态', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    const terminal1 = store.consumeEvent(ev({ type: 'progress', ts: 1, message: '理解中' }))
    const terminal2 = store.consumeEvent(ev({ type: 'tool', ts: 2, tool: 'retrieve', result: 'ok' }))
    expect(terminal1).toBe(false)
    expect(terminal2).toBe(false)
    expect(store.pendingSteps).toHaveLength(2)
    expect(store.status).toBe('generating')
  })

  it('consumeEvent 流式 confirm（有 ts 无 schema）入 pendingSteps，非终态', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    const terminal = store.consumeEvent(ev({ type: 'confirm', ts: 1, message: '等待' }))
    expect(terminal).toBe(false)
    expect(store.pendingSteps).toHaveLength(1)
    expect(store.status).toBe('generating')
  })

  it('consumeEvent 终态 confirm（有 schema）进入 awaiting_confirm，终态', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    const terminal = store.consumeEvent(
      ev({ type: 'confirm', session_id: 's1', schema: { root: { id: 'r', type: 'LubanPage' } } }),
    )
    expect(terminal).toBe(true)
    expect(store.status).toBe('awaiting_confirm')
    expect(store.pendingSchema).not.toBeNull()
    expect(store.sessionId).toBe('s1')
    expect(store.hasPending).toBe(true)
  })

  it('consumeEvent error 进入 failed', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    const terminal = store.consumeEvent(ev({ type: 'error', message: '生成失败' }))
    expect(terminal).toBe(true)
    expect(store.status).toBe('failed')
    expect(store.error).toBe('生成失败')
    expect(store.isFailed).toBe(true)
  })

  it('confirmApply 进入 applied + 清 pendingSchema + flush assistant 消息', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    store.consumeEvent(ev({ type: 'confirm', session_id: 's1', schema: { root: { id: 'r', type: 'LubanPage' } } }))
    store.confirmApply()
    expect(store.status).toBe('applied')
    expect(store.pendingSchema).toBeNull()
    // 应有 user + assistant 两条消息
    expect(store.messages.filter((m) => m.role === 'assistant')).toHaveLength(1)
  })

  it('confirmReject 进入 rejected', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    store.consumeEvent(ev({ type: 'confirm', session_id: 's1', schema: { root: { id: 'r', type: 'LubanPage' } } }))
    store.confirmReject()
    expect(store.status).toBe('rejected')
    expect(store.pendingSchema).toBeNull()
  })

  it('setFailed 设置错误态', () => {
    const store = useAiStore()
    store.setFailed('网络错误')
    expect(store.status).toBe('failed')
    expect(store.error).toBe('网络错误')
  })

  it('resetToIdle 回到空闲态（保留消息历史）', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    store.setFailed('err')
    store.resetToIdle()
    expect(store.status).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.messages).toHaveLength(1) // 消息保留
  })

  it('clearAll 清空全部', () => {
    const store = useAiStore()
    store.pushUserMessage('x')
    store.consumeEvent(ev({ type: 'confirm', session_id: 's1', schema: { root: { id: 'r', type: 'LubanPage' } } }))
    store.clearAll()
    expect(store.status).toBe('idle')
    expect(store.messages).toHaveLength(0)
    expect(store.pendingSchema).toBeNull()
  })

  it('setConfig 设置模型配置', () => {
    const store = useAiStore()
    store.setConfig({ model: { provider: 'glm', name: 'glm-4' }, features: { generate: true, guidance: true } })
    expect(store.config?.model.provider).toBe('glm')
  })

  it('isGenerating / hasPending 计算属性正确', () => {
    const store = useAiStore()
    expect(store.isGenerating).toBe(false)
    store.pushUserMessage('x')
    expect(store.isGenerating).toBe(true)
    store.consumeEvent(ev({ type: 'confirm', session_id: 's1', schema: { root: { id: 'r', type: 'LubanPage' } } }))
    expect(store.isGenerating).toBe(false)
    expect(store.hasPending).toBe(true)
  })
})
