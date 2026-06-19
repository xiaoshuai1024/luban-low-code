/**
 * stores/ai.ts — AI 助手会话状态（状态机 + 消息流）。
 *
 * 状态机：idle → generating → awaiting_confirm → applied | rejected | failed
 * （plan §3）。消息流存 AI 面板对话历史。
 *
 * 不持久化（会话态），刷新清空。HITL 确认后由 usePageEditorApi 落地 schema。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PageSchema } from '@/types/schema'

export type AiSessionStatus = 'idle' | 'generating' | 'awaiting_confirm' | 'applied' | 'rejected' | 'failed'

export interface AiMessage {
  id: string
  role: 'user' | 'ai'
  /** AI 消息：进度文本/工具调用摘要/待确认 schema 提示 */
  text?: string
  /** AI 事件类型（progress/tool/warning/confirm/done/error） */
  kind?: 'progress' | 'tool' | 'warning' | 'confirm' | 'done' | 'error' | 'text'
  /** 待确认 schema（confirm 态） */
  pendingSchema?: PageSchema | null
  /** 关联会话 id（AI 服务侧） */
  sessionId?: string
}

export const useAiStore = defineStore('ai', () => {
  const status = ref<AiSessionStatus>('idle')
  const messages = ref<AiMessage[]>([])
  /** 当前待确认 schema（awaiting_confirm） */
  const pendingSchema = ref<PageSchema | null>(null)
  const pendingSessionId = ref<string | null>(null)
  const error = ref<string | null>(null)

  const isGenerating = computed(() => status.value === 'generating')
  const isAwaitingConfirm = computed(() => status.value === 'awaiting_confirm')

  function reset() {
    status.value = 'idle'
    messages.value = []
    pendingSchema.value = null
    pendingSessionId.value = null
    error.value = null
  }

  function startGenerating(userMessage: string) {
    status.value = 'generating'
    error.value = null
    pendingSchema.value = null
    messages.value.push({
      id: `u-${Date.now()}`,
      role: 'user',
      kind: 'text',
      text: userMessage,
    })
  }

  function pushAiMessage(msg: Omit<AiMessage, 'id' | 'role'>) {
    messages.value.push({ id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: 'ai', ...msg })
  }

  function setConfirm(schema: PageSchema | null, sessionId: string) {
    status.value = 'awaiting_confirm'
    pendingSchema.value = schema
    pendingSessionId.value = sessionId
    pushAiMessage({ kind: 'confirm', text: '✅ 生成完成，请确认是否应用到画布', pendingSchema: schema, sessionId })
  }

  function markApplied() {
    status.value = 'applied'
    pendingSchema.value = null
    pushAiMessage({ kind: 'done', text: '已应用到画布' })
  }

  function markRejected() {
    status.value = 'rejected'
    pendingSchema.value = null
    pushAiMessage({ kind: 'text', text: '已拒绝' })
  }

  function markFailed(msg: string) {
    status.value = 'failed'
    error.value = msg
    pushAiMessage({ kind: 'error', text: `❌ ${msg}` })
  }

  return {
    status,
    messages,
    pendingSchema,
    pendingSessionId,
    error,
    isGenerating,
    isAwaitingConfirm,
    reset,
    startGenerating,
    pushAiMessage,
    setConfirm,
    markApplied,
    markRejected,
    markFailed,
  }
})
