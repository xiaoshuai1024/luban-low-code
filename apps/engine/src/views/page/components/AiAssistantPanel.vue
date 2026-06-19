<script setup lang="ts">
/**
 * AiAssistantPanel.vue — AI 助手侧边面板（右侧抽屉）。
 *
 * 交互链（plan §4.2/§4.3）：
 *   输入需求 → streamAi(/ai/chat) → 流式显示进度 → confirm 展示待确认 schema 预览
 *   → [应用到画布]（经 usePageEditorApi.applySchema + history.push 入撤销栈）
 *     / [拒绝]
 *
 * 四态：加载(流式 spinner) / 空(引导建议) / 错(校验失败) / 成功(预览+确认)。
 * 模型只读展示当前部署模型（/ai/config）。
 *
 * FeatureGate ai_assistant_enabled 关闭 → 整个面板不渲染（PageEditor 控制挂载）。
 */
import { ref, onMounted, nextTick, watch } from 'vue'
import { ElInput, ElButton, ElTag, ElEmpty, ElMessage } from 'element-plus'
import { useAiStore } from '@/stores/ai'
import { streamAi, getAiConfig, type AiConfig } from '@/api/ai'
import type { UsePageEditorApiReturn } from '@/composables/usePageEditorApi'
import type { PageSchema, NodeSchema } from '@/types/schema'

const props = defineProps<{
  /** 由 PageEditor 注入的画布操作 API */
  editorApi: UsePageEditorApiReturn
  /** 当前 schema（供预览/上下文，AI 服务侧可读） */
  schema: PageSchema | null
  /** siteId/pageId（传给 AI 服务） */
  siteId?: string
  pageId?: string
}>()

const ai = useAiStore()
const input = ref('')
const config = ref<AiConfig | null>(null)
const loadingConfig = ref(false)
const activeController = ref<AbortController | null>(null)
const messagesRef = ref<HTMLElement | null>(null)

onMounted(loadConfig)

async function loadConfig() {
  loadingConfig.value = true
  try {
    config.value = await getAiConfig()
  } catch (e) {
    // 配置获取失败不阻断（功能未启用时面板会提示）
    config.value = null
  } finally {
    loadingConfig.value = false
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}

watch(() => ai.messages.length, scrollToBottom)

async function handleSend() {
  const text = input.value.trim()
  if (!text) return
  if (ai.isGenerating) return

  input.value = ''
  ai.startGenerating(text)

  activeController.value = streamAi(
    '/ai/chat',
    { siteId: props.siteId, pageId: props.pageId, message: text },
    {
      onProgress: (ev) => {
        // 流式进度/工具调用摘要
        const label = progressLabel(ev)
        if (label) ai.pushAiMessage({ kind: (ev.type as 'progress' | 'tool' | 'warning') ?? 'progress', text: label })
      },
      onConfirm: (ev) => {
        ai.setConfirm(ev.schema, ev.session_id)
      },
      onError: (ev) => {
        ai.markFailed(ev.message)
      },
      onDone: () => {
        // applied/rejected 由用户操作触发；done 仅在无 confirm 时收尾
        if (ai.status === 'generating') ai.markFailed('未收到确认事件')
      },
    }
  )
}

function progressLabel(ev: { type: string; [k: string]: unknown }): string | null {
  if (ev.type === 'progress' && ev.message) return `🔄 ${ev.message}`
  if (ev.type === 'tool') {
    if (ev.tool === 'understand') return `🔍 理解需求…`
    if (ev.tool === 'retrieve') return `🔍 检索物料：${Array.isArray(ev.materials) ? (ev.materials as string[]).join('、') : ''}`
    if (ev.tool === 'generate') return ev.ok ? '✍️ 生成页面结构…' : `⚠️ 生成失败：${ev.error ?? ''}`
    if (ev.tool === 'validate') return ev.ok ? '✅ 校验通过' : `⚠️ 校验失败，重试…`
    if (ev.tool === 'feedback') return '🔄 校验失败，重新生成…'
  }
  if (ev.type === 'warning' && ev.missing_materials) return `⚠️ 物料未注册：${(ev.missing_materials as string[]).join('、')}`
  if (ev.type === 'intent') return `📌 意图：${ev.summary ?? ''}`
  return null
}

function handleApply() {
  if (!ai.pendingSchema) return
  props.editorApi.applySchema(ai.pendingSchema, 'AI 生成页面')
  ai.markApplied()
  ElMessage.success('已应用到画布（可 Ctrl+Z 撤销）')
}

function handleReject() {
  ai.markRejected()
}

function handleCancel() {
  activeController.value?.abort()
  ai.markFailed('已取消')
}

/** schema 预览：树形简化（type + props 关键字段），非纯 JSON dump */
function previewTree(schema: PageSchema | null | undefined): string {
  if (!schema?.root) return '（空）'
  const lines: string[] = []
  const walk = (node: NodeSchema, depth: number) => {
    const pad = '  '.repeat(depth)
    const label = node.type
    const propHint = node.props && Object.keys(node.props).length
      ? ` (${Object.entries(node.props).slice(0, 2).map(([k, v]) => `${k}=${String(v)}`).join(', ')})`
      : ''
    lines.push(`${pad}- ${label}${propHint}`)
    for (const c of node.children ?? []) walk(c, depth + 1)
  }
  walk(schema.root, 0)
  return lines.join('\n')
}
</script>

<template>
  <div class="ai-panel">
    <div class="ai-panel__header">
      <span class="ai-panel__title">AI 助手</span>
      <ElTag v-if="config" size="small" type="info">
        {{ config.model.name }}
      </ElTag>
    </div>

    <!-- 消息流 -->
    <div ref="messagesRef" class="ai-panel__messages">
      <ElEmpty v-if="ai.messages.length === 0" description="描述你想要的页面，AI 帮你生成" :image-size="60" />
      <div
        v-for="msg in ai.messages"
        :key="msg.id"
        class="ai-panel__msg"
        :class="`ai-panel__msg--${msg.role}`"
      >
        <div class="ai-panel__msg-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
        <div class="ai-panel__msg-body">
          <div v-if="msg.text">{{ msg.text }}</div>
          <!-- 待确认 schema 预览（树形，非 JSON dump） -->
          <pre v-if="msg.kind === 'confirm'" class="ai-panel__preview">{{ previewTree(msg.pendingSchema) }}</pre>
        </div>
      </div>
      <div v-if="ai.isGenerating" class="ai-panel__msg ai-panel__msg--ai">
        <div class="ai-panel__msg-role">AI</div>
        <div class="ai-panel__msg-body"><span class="ai-panel__spinner" />正在生成…</div>
      </div>
    </div>

    <!-- 确认操作 -->
    <div v-if="ai.isAwaitingConfirm" class="ai-panel__confirm">
      <ElButton type="primary" size="small" @click="handleApply">应用到画布</ElButton>
      <ElButton size="small" @click="handleReject">拒绝</ElButton>
    </div>

    <!-- 输入区 -->
    <div class="ai-panel__input">
      <ElInput
        v-model="input"
        type="textarea"
        :rows="2"
        placeholder="描述你想要的页面，如：做一个用户列表页"
        :disabled="ai.isGenerating"
        @keydown.enter.exact.prevent="handleSend"
      />
      <div class="ai-panel__input-actions">
        <ElButton v-if="ai.isGenerating" size="small" @click="handleCancel">取消</ElButton>
        <ElButton v-else type="primary" size="small" :disabled="!input.trim()" @click="handleSend">
          发送
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #ebeef5;
    flex-shrink: 0;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }

  &__messages {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    min-height: 0;
  }

  &__msg {
    margin-bottom: 10px;

    &--user {
      .ai-panel__msg-role { color: #409eff; }
      .ai-panel__msg-body {
        background: #ecf5ff;
        align-self: flex-end;
      }
    }
    &--ai {
      .ai-panel__msg-role { color: #67c23a; }
      .ai-panel__msg-body { background: #f4f4f5; }
    }
  }

  &__msg-role {
    font-size: 11px;
    margin-bottom: 2px;
  }

  &__msg-body {
    font-size: 13px;
    line-height: 1.5;
    padding: 8px 10px;
    border-radius: 6px;
    color: #303133;
  }

  &__preview {
    margin: 6px 0 0;
    padding: 8px;
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 240px;
    overflow: auto;
  }

  &__spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid #dcdfe6;
    border-top-color: #409eff;
    border-radius: 50%;
    animation: ai-spin 0.8s linear infinite;
    margin-right: 6px;
    vertical-align: middle;
  }

  &__confirm {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid #ebeef5;
    flex-shrink: 0;
  }

  &__input {
    border-top: 1px solid #ebeef5;
    padding: 8px 12px;
    flex-shrink: 0;
  }

  &__input-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }
}

@keyframes ai-spin {
  to { transform: rotate(360deg); }
}
</style>
