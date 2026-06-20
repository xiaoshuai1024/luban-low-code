<script setup lang="ts">
/**
 * AiAssistantPanel.vue — AI 助手侧边抽屉（plan P1-T8/T9 + P2-T4）。
 *
 * 形态：ElDrawer 右侧浮层（零侵入，不破坏 PageEditor 三栏 flex 布局 plan §4.3）。
 * 三 tab：
 *   [对话]    自然语言生成/编辑页面（SSE 流式 + HITL 确认）
 *   [引导]    读当前 schema 给下一步建议（规则化，GET /ai/guidance）
 *   [设计稿]  设计稿转页面（plan P2-T4，FeatureGate ai.design_to_page 控制）
 *
 * 四态（plan §4.2）：加载(generating spinner) / 空(引导建议) / 错(failed+重试) /
 * 成功(awaiting_confirm 预览+确认)。
 *
 * 落地：确认后经 usePageEditorApi.replaceSchema（整页）落画布，自动入撤销栈
 * （Ctrl+Z 可撤销 AI 改动 plan §3 验收口径）。会话状态经 useAiStore（pinia）。
 */
import { ref, computed, watch, onMounted } from 'vue'
import {
  ElDrawer,
  ElTabs,
  ElTabPane,
  ElInput,
  ElButton,
  ElMessage,
  ElEmpty,
  ElAlert,
  ElTag,
  ElCard,
} from 'element-plus'
import { useAiStore } from '@/stores/ai'
import { useFeatureGate } from '@/composables/useFeatureGate'
import {
  streamChat,
  streamDesignToPage,
  getAiConfig,
  getAiGuidance,
  AiApiError,
  type AiGuidanceTip,
} from '@/api/ai'
import type { PageSchema, NodeSchema } from '@/types/schema'
import type { PageEditorApi } from '@/composables/usePageEditorApi'
import SchemaTreePreview from './SchemaTreePreview.vue'
import DesignUploader from './DesignUploader.vue'
import DesignPreview from './DesignPreview.vue'

interface Props {
  modelValue: boolean
  siteId: string
  pageId: string
  schema: PageSchema | null
  api: PageEditorApi
  selectedId: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const store = useAiStore()
const { isEnabled } = useFeatureGate()
const featureDesignToPage = isEnabled('ai.design_to_page')

const drawerOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const activeTab = ref<'chat' | 'guidance' | 'design'>('chat')
const inputText = ref('')
const guidanceTips = ref<AiGuidanceTip[]>([])
const guidanceLoading = ref(false)
const applying = ref(false)

let abortCtrl: AbortController | null = null

/** 当前画布是否为空（仅 root 无 children）。 */
const schemaEmpty = computed(() => {
  return !props.schema?.root?.children || props.schema.root.children.length === 0
})

onMounted(async () => {
  // 拉取模型配置（只读展示当前部署模型 plan §4.3 模型展示只读）
  try {
    const cfg = await getAiConfig()
    store.setConfig(cfg)
  } catch {
    // 配置拉取失败不阻断面板（功能可能仍可用）
  }
})

/** 发送对话生成请求。 */
async function send() {
  const text = inputText.value.trim()
  if (!text) return
  if (store.isGenerating) return

  inputText.value = ''
  store.pushUserMessage(text)

  abortCtrl?.abort()
  abortCtrl = new AbortController()
  try {
    for await (const ev of streamChat(
      { siteId: props.siteId, pageId: props.pageId, message: text, context: { currentSchema: props.schema } },
      abortCtrl.signal,
    )) {
      store.consumeEvent(ev)
    }
  } catch (e) {
    if (e instanceof AiApiError) {
      if (e.code === 'AI_FEATURE_DISABLED') {
        store.setFailed('AI 生成功能未启用')
      } else if (e.code === 'UNAUTHENTICATED') {
        store.setFailed('登录已过期，请重新登录')
      } else {
        store.setFailed(e.message)
      }
    } else if ((e as Error)?.name !== 'AbortError') {
      store.setFailed((e as Error)?.message || '生成失败，请重试')
    }
  }
}

/** 确认应用 schema 到画布（整页生成 → replaceSchema，入撤销栈）。 */
function applySchema() {
  if (!store.pendingSchema) return
  applying.value = true
  try {
    const newRoot = store.pendingSchema.root as NodeSchema
    props.api.replaceSchema(newRoot)
    store.confirmApply()
    ElMessage.success('已应用到画布（Ctrl+Z 可撤销）')
  } catch (e) {
    ElMessage.error((e as Error)?.message || '应用失败')
  } finally {
    applying.value = false
  }
}

function rejectSchema() {
  store.confirmReject()
}

/** 加载引导建议（切到引导 tab 时）。 */
async function loadGuidance() {
  if (guidanceTips.value.length > 0) return
  guidanceLoading.value = true
  try {
    const res = await getAiGuidance(schemaEmpty.value)
    guidanceTips.value = res.tips
  } catch (e) {
    if (e instanceof AiApiError && e.code === 'AI_FEATURE_DISABLED') {
      guidanceTips.value = [{ level: 'warn', title: '引导未启用', detail: '当前部署未开启 AI 引导功能' }]
    } else {
      guidanceTips.value = []
    }
  } finally {
    guidanceLoading.value = false
  }
}

/** 切 tab 时触发对应加载。 */
watch(activeTab, (tab) => {
  if (tab === 'guidance') loadGuidance()
})

/** 抽屉关闭时中止进行中的请求。 */
watch(drawerOpen, (open) => {
  if (!open) {
    abortCtrl?.abort()
  }
})

/** 引导建议点击 action → 填入对话输入。 */
function applyGuidanceAction(tip: AiGuidanceTip) {
  if (tip.action) {
    inputText.value = tip.action
    activeTab.value = 'chat'
  }
}

/** 重试（failed 态）。 */
function retry() {
  const lastUser = [...store.messages].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    store.resetToIdle()
    inputText.value = lastUser.content
    send()
  } else {
    store.resetToIdle()
  }
}

// ===== 设计稿转页面（plan P2-T4）=====
const designImageUrl = ref<string | null>(null)
const designSteps = computed(() => store.pendingSteps)

/** 设计稿上传后发起 design-to-page 请求。 */
async function onDesignSelect(file: File) {
  designImageUrl.value = URL.createObjectURL(file)
  store.resetToIdle()
  store.pushUserMessage('（设计稿转页面）')

  abortCtrl?.abort()
  abortCtrl = new AbortController()
  try {
    for await (const ev of streamDesignToPage(
      { image: file, siteId: props.siteId, pageId: props.pageId, context: { currentSchema: props.schema } },
      abortCtrl.signal,
    )) {
      store.consumeEvent(ev)
    }
  } catch (e) {
    if (e instanceof AiApiError) {
      if (e.code === 'AI_FEATURE_DISABLED') {
        store.setFailed('设计稿功能未启用')
      } else if (e.code === 'INVALID_IMAGE') {
        store.setFailed('图片不合法：' + e.message)
      } else if (e.code === 'UNAUTHENTICATED') {
        store.setFailed('登录已过期，请重新登录')
      } else {
        store.setFailed(e.message)
      }
    } else if ((e as Error)?.name !== 'AbortError') {
      store.setFailed((e as Error)?.message || '设计稿理解失败，请重试')
    }
  }
}

/** 设计稿确认应用（复用对话的 applySchema，整页 replaceSchema 入撤销栈）。 */
</script>

<template>
  <ElDrawer
    v-model="drawerOpen"
    title="AI 助手"
    direction="rtl"
    size="420px"
    :destroy-on-close="false"
    class="ai-panel"
  >
    <div class="ai-panel__model" v-if="store.config">
      <ElTag size="small" type="info">
        模型：{{ store.config.model.provider }} / {{ store.config.model.name }}
      </ElTag>
    </div>

    <ElTabs v-model="activeTab" class="ai-panel__tabs">
      <!-- 对话 tab -->
      <ElTabPane label="对话" name="chat">
        <div class="ai-panel__messages">
          <ElEmpty v-if="store.messages.length === 0 && !store.isGenerating" description="描述你想要的页面，AI 帮你生成" />
          <template v-for="msg in store.messages" :key="msg.id">
            <div :class="['ai-panel__msg', `ai-panel__msg--${msg.role}`]">
              <div class="ai-panel__msg-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
              <div class="ai-panel__msg-content">{{ msg.content }}</div>
            </div>
          </template>

          <!-- 流式进度（generating 态） -->
          <div v-if="store.isGenerating" class="ai-panel__progress">
            <div v-for="(step, idx) in store.pendingSteps" :key="idx" class="ai-panel__step">
              <span v-if="step.type === 'progress'">🔍 {{ step.message }}</span>
              <span v-else-if="step.type === 'tool'">🛠 {{ step.tool }}</span>
              <span v-else-if="step.type === 'intent'">💡 {{ step.summary }}</span>
              <span v-else-if="step.type === 'warning'">⚠️ 缺少物料：{{ step.missing_materials.join(', ') }}</span>
            </div>
            <span class="ai-panel__spinner">生成中…</span>
          </div>

          <!-- 错误态 -->
          <ElAlert
            v-if="store.isFailed"
            :title="store.error || '生成失败'"
            type="error"
            show-icon
            :closable="false"
          >
            <ElButton size="small" @click="retry">重试</ElButton>
          </ElAlert>

          <!-- 待确认预览（awaiting_confirm 态） -->
          <div v-if="store.hasPending" class="ai-panel__confirm">
            <div class="ai-panel__confirm-title">✅ 已生成，请确认</div>
            <SchemaTreePreview :schema="store.pendingSchema" class="ai-panel__preview" />
            <div class="ai-panel__confirm-actions">
              <ElButton type="primary" :loading="applying" @click="applySchema">应用到画布</ElButton>
              <ElButton @click="rejectSchema">拒绝</ElButton>
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="ai-panel__input">
          <ElInput
            v-model="inputText"
            type="textarea"
            :rows="2"
            placeholder="描述你想要的页面，如「做一个用户列表页」"
            @keydown.enter.exact.prevent="send"
          />
          <ElButton type="primary" :loading="store.isGenerating" @click="send">发送</ElButton>
        </div>
      </ElTabPane>

      <!-- 引导 tab -->
      <ElTabPane label="引导" name="guidance">
        <div v-loading="guidanceLoading" class="ai-panel__guidance">
          <ElEmpty v-if="!guidanceLoading && guidanceTips.length === 0" description="暂无引导建议" />
          <ElCard
            v-for="(tip, idx) in guidanceTips"
            :key="idx"
            shadow="hover"
            class="ai-panel__tip"
          >
            <div class="ai-panel__tip-title">
              <ElTag size="small" :type="tip.level === 'warn' ? 'warning' : tip.level === 'block' ? 'danger' : 'info'">
                {{ tip.title }}
              </ElTag>
            </div>
            <p class="ai-panel__tip-detail">{{ tip.detail }}</p>
            <ElButton v-if="tip.action" link type="primary" @click="applyGuidanceAction(tip)">
              {{ tip.action }}
            </ElButton>
          </ElCard>
        </div>
      </ElTabPane>

      <!-- 设计稿 tab（plan P2-T4，FeatureGate ai.design_to_page 控制） -->
      <ElTabPane v-if="featureDesignToPage" label="设计稿" name="design">
        <div class="ai-panel__design">
          <DesignUploader :disabled="store.isGenerating" @select="onDesignSelect" />

          <!-- 流式理解进度 + 对照预览（generating / awaiting_confirm 态） -->
          <template v-if="store.isGenerating || store.hasPending || store.isFailed">
            <DesignPreview
              :image-url="designImageUrl"
              :schema="store.pendingSchema"
              :steps="designSteps"
            />
          </template>
          <ElEmpty
            v-else
            description="拖入设计稿图片，AI 识别布局与组件生成页面"
          />

          <!-- 错误态 -->
          <ElAlert
            v-if="store.isFailed"
            :title="store.error || '设计稿理解失败'"
            type="error"
            show-icon
            :closable="false"
          />

          <!-- 待确认 HITL（复用对话的 confirm/reject） -->
          <div v-if="store.hasPending" class="ai-panel__confirm-actions">
            <ElButton type="primary" :loading="applying" @click="applySchema">应用到画布</ElButton>
            <ElButton @click="rejectSchema">拒绝</ElButton>
          </div>
        </div>
      </ElTabPane>
    </ElTabs>
  </ElDrawer>
</template>

<style lang="scss" scoped>
.ai-panel {
  &__model {
    margin-bottom: 8px;
  }

  &__tabs {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  &__messages {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 200px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 4px;
  }

  &__msg {
    padding: 8px 12px;
    border-radius: 8px;
    max-width: 90%;

    &--user {
      align-self: flex-end;
      background: #ecf5ff;
      color: #303133;
    }

    &--assistant {
      align-self: flex-start;
      background: #f4f4f5;
      color: #303133;
    }
  }

  &__msg-role {
    font-size: 11px;
    color: #909399;
    margin-bottom: 2px;
  }

  &__progress {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: #fafafa;
    border-radius: 6px;
  }

  &__step {
    font-size: 13px;
    color: #606266;
  }

  &__spinner {
    font-size: 13px;
    color: #409eff;
    margin-top: 4px;
  }

  &__confirm {
    border: 1px solid #d9ecff;
    border-radius: 8px;
    padding: 12px;
    background: #fff;
  }

  &__confirm-title {
    font-weight: 600;
    color: #67c23a;
    margin-bottom: 8px;
  }

  &__preview {
    margin: 8px 0;
    max-height: 240px;
    overflow-y: auto;
  }

  &__confirm-actions {
    display: flex;
    gap: 8px;
  }

  &__input {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-top: 12px;
  }

  &__guidance {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__tip {
    :deep(.el-card__body) {
      padding: 12px;
    }
  }

  &__tip-detail {
    font-size: 13px;
    color: #606266;
    margin: 8px 0;
  }
}
</style>
