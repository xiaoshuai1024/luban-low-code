/**
 * stores/ai.ts — AI 助手会话状态（plan P1-T8 + P2-T4）。
 *
 * 会话状态机：idle → generating → awaiting_confirm → applied | rejected | failed
 *   - idle：空闲，等待用户输入
 *   - generating：agent 执行中（流式 progress/tool 事件累计）
 *   - awaiting_confirm：生成完毕待 HITL 确认（整页/覆盖/删除须确认 plan §3 Q5）
 *   - applied：用户确认，schema 已落地画布
 *   - rejected：用户拒绝
 *   - failed：校验失败回环超限 / 理解失败 / 网络错误
 *
 * 职责：维护消息流（对话气泡）、进度事件、待确认 schema、当前 provider。
 * 不负责落地画布（落地经 usePageEditorApi，保证入撤销栈）。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AiSseEvent, AiConfig, AiSessionStatus } from '@/api/ai'
import type { PageSchema } from '@/types/schema'

/** 一条对话消息（气泡）。 */
export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  ts: number
  /** assistant 消息可附带进度步骤（来自 progress/tool 事件）。 */
  steps?: AiSseEvent[]
}

/** 当前会话快照（驱动面板四态：加载/空/错/成功）。 */
export interface AiSessionState {
  status: AiSessionStatus
  messages: AiMessage[]
  /** 生成中累计的进度事件（generating 态展示）。 */
  pendingSteps: AiSseEvent[]
  /** 待确认 schema（awaiting_confirm 态）。 */
  pendingSchema: PageSchema | null
  /** 当前会话 id（来自终态 confirm 的 session_id）。 */
  sessionId: string | null
  /** 错误信息（failed 态）。 */
  error: string | null
  /** 模型配置（只读展示）。 */
  config: AiConfig | null
}

export const useAiStore = defineStore('ai', () => {
  const status = ref<AiSessionStatus>('idle')
  const messages = ref<AiMessage[]>([])
  const pendingSteps = ref<AiSseEvent[]>([])
  const pendingSchema = ref<PageSchema | null>(null)
  const sessionId = ref<string | null>(null)
  const error = ref<string | null>(null)
  const config = ref<AiConfig | null>(null)

  /** 是否处于流式生成中（面板显示 spinner）。 */
  const isGenerating = computed(() => status.value === 'generating')
  /** 是否有待确认 schema（面板显示 HITL 确认区）。 */
  const hasPending = computed(() => status.value === 'awaiting_confirm' && pendingSchema.value !== null)
  /** 是否失败态（面板显示错误+重试）。 */
  const isFailed = computed(() => status.value === 'failed')

  /** 重置到空闲态（不清消息历史，保留对话上下文）。 */
  function resetToIdle() {
    status.value = 'idle'
    pendingSteps.value = []
    pendingSchema.value = null
    sessionId.value = null
    error.value = null
  }

  /** 用户发送消息：追加 user 气泡，进入 generating。 */
  function pushUserMessage(content: string) {
    messages.value.push({
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content,
      ts: Date.now(),
    })
    status.value = 'generating'
    pendingSteps.value = []
    pendingSchema.value = null
    sessionId.value = null
    error.value = null
  }

  /**
   * 消费一个 SSE 事件，更新会话状态。
   * 返回是否为终态事件（done/error/终态confirm）。
   */
  function consumeEvent(ev: AiSseEvent): boolean {
    switch (ev.type) {
      case 'progress':
      case 'tool':
      case 'intent':
      case 'warning':
        pendingSteps.value.push(ev)
        return false
      case 'confirm':
        // 区分流式 confirm（hitl 节点，有 ts 无 schema）与终态 confirm（有 schema）。
        if ('schema' in ev && ev.schema !== undefined) {
          // 终态：进入待确认
          pendingSchema.value = ev.schema
          sessionId.value = ev.session_id
          status.value = 'awaiting_confirm'
          return true
        }
        // 流式 confirm：仅作为进度步骤
        pendingSteps.value.push(ev)
        return false
      case 'error':
        status.value = 'failed'
        error.value = ev.message
        return true
      case 'done':
        // done 终态：若非 awaiting_confirm（如单属性编辑直接应用），回到 idle
        if (status.value !== 'awaiting_confirm') {
          // 收集 progress 步骤为 assistant 气泡
          flushStepsToMessage()
          status.value = 'applied'
          setTimeout(() => {
            if (status.value === 'applied') status.value = 'idle'
          }, 0)
        }
        return true
      default:
        return false
    }
  }

  /** 把累积的 pendingSteps 归并进一条 assistant 消息（生成完成时）。 */
  function flushStepsToMessage(fallbackText = '已完成') {
    const steps = pendingSteps.value
    const text = steps
      .filter((s) => s.type === 'progress')
      .map((s) => (s as { message: string }).message)
      .join('；')
    messages.value.push({
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: text || fallbackText,
      ts: Date.now(),
      steps: [...steps],
    })
    pendingSteps.value = []
  }

  /** 用户确认应用 schema → applied（落地由面板调用 usePageEditorApi）。 */
  function confirmApply() {
    flushStepsToMessage('已应用到画布')
    status.value = 'applied'
    pendingSchema.value = null
  }

  /** 用户拒绝 → rejected。 */
  function confirmReject() {
    flushStepsToMessage('已取消')
    status.value = 'rejected'
    pendingSchema.value = null
  }

  /** 设置错误（网络/未启用等）。 */
  function setFailed(msg: string) {
    status.value = 'failed'
    error.value = msg
    pendingSteps.value = []
  }

  function setConfig(cfg: AiConfig) {
    config.value = cfg
  }

  /** 清空全部会话（切换页面/关闭面板时）。 */
  function clearAll() {
    status.value = 'idle'
    messages.value = []
    pendingSteps.value = []
    pendingSchema.value = null
    sessionId.value = null
    error.value = null
  }

  return {
    status,
    messages,
    pendingSteps,
    pendingSchema,
    sessionId,
    error,
    config,
    isGenerating,
    hasPending,
    isFailed,
    resetToIdle,
    pushUserMessage,
    consumeEvent,
    flushStepsToMessage,
    confirmApply,
    confirmReject,
    setFailed,
    setConfig,
    clearAll,
  }
})
