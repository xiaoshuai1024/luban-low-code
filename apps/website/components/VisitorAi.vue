<template>
  <!-- 访客 AI 助手（C 端问答）：悬浮按钮 + 抽屉面板（e2e 契约 .visitor-ai__fab / .visitor-ai__panel） -->
  <div class="visitor-ai">
    <button
      v-if="!open"
      class="visitor-ai__fab"
      type="button"
      aria-label="AI 助手"
      @click="open = true"
    >
      ✨ AI
    </button>

    <div v-else class="visitor-ai__panel" role="dialog" aria-label="AI 助手对话">
      <div class="visitor-ai__header">
        <span>AI 助手</span>
        <button class="visitor-ai__close" type="button" aria-label="关闭" @click="open = false">×</button>
      </div>

      <div class="visitor-ai__msgs">
        <div v-if="messages.length === 0" class="visitor-ai__empty">
          你好，我是站点 AI 助手，可以咨询产品与预约问题。
        </div>
        <div
          v-for="(m, i) in messages"
          :key="i"
          :class="['visitor-ai__msg', `visitor-ai__msg--${m.role}`]"
        >
          {{ m.content }}
        </div>
        <div v-if="error" class="visitor-ai__msg visitor-ai__msg--error">{{ error }}</div>
      </div>

      <div class="visitor-ai__form">
        <input
          v-model="input"
          class="visitor-ai__input"
          type="text"
          placeholder="输入你的问题…"
          :disabled="sending"
          @keydown.enter.prevent="send"
        />
        <button class="visitor-ai__send" type="button" :disabled="sending || !input.trim()" @click="send">
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 访客 AI 问答（@J-ai-c-assist）：走 BFF 公开端点 POST /api/ai/chat（SSE）。
 * BFF 侧对访客强制 tools=[]（禁工具调用）；AI 服务不可达/未配置时如实提示，不假造回复。
 */
const open = ref(false)
const input = ref('')
const sending = ref(false)
const error = ref('')
const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])

function bffBase(): string {
  const config = useRuntimeConfig()
  return ((config.public.bffBaseUrl as string) || '').replace(/\/$/, '')
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  sending.value = true
  error.value = ''
  try {
    const res = await fetch(`${bffBase()}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
    if (!res.ok || !res.body) {
      // AI 服务不可达（502/503）等：展示真实错误，不假造 AI 回复
      error.value = `AI 服务暂时不可用（${res.status}），请稍后再试`
      return
    }
    // SSE 流式：逐行解析 data: JSON，取增量文本
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let reply = ''
    messages.value.push({ role: 'assistant', content: '' })
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const ev = JSON.parse(payload)
          const delta: string = ev.delta ?? ev.content ?? ev.text ?? ''
          if (delta) {
            reply += delta
            messages.value[messages.value.length - 1] = { role: 'assistant', content: reply }
          }
        } catch {
          // 非 JSON 帧忽略
        }
      }
    }
    if (!reply) {
      messages.value[messages.value.length - 1] = {
        role: 'assistant',
        content: '（AI 未返回内容）',
      }
    }
  } catch (e) {
    error.value = `请求失败：${(e as Error).message}`
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.visitor-ai {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 9999;
}

.visitor-ai__fab {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--el-color-primary, #409eff);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.visitor-ai__panel {
  width: 320px;
  max-width: 86vw;
  height: 420px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.visitor-ai__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--el-color-primary, #409eff);
  color: #fff;
  font-weight: 600;
}

.visitor-ai__close {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

.visitor-ai__msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.visitor-ai__empty {
  color: #999;
  font-size: 13px;
}

.visitor-ai__msg {
  max-width: 85%;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.visitor-ai__msg--user {
  align-self: flex-end;
  background: var(--el-color-primary, #409eff);
  color: #fff;
}

.visitor-ai__msg--assistant {
  align-self: flex-start;
  background: #f4f4f5;
  color: #333;
}

.visitor-ai__msg--error {
  align-self: center;
  color: #f56c6c;
  font-size: 12px;
}

.visitor-ai__form {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid #eee;
}

.visitor-ai__input {
  flex: 1;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  outline: none;
}

.visitor-ai__send {
  border: none;
  border-radius: 6px;
  background: var(--el-color-primary, #409eff);
  color: #fff;
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
}

.visitor-ai__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
