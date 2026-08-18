<template>
  <ElCard shadow="never" class="ai-model-tab">
    <ElForm label-width="110px">
      <ElFormItem label="当前模型">
        <span v-if="loading">加载中…</span>
        <ElTag v-else-if="currentProvider" type="info">
          {{ currentProvider }} / {{ config?.model?.name || '默认' }}
        </ElTag>
        <span v-else-if="loadError" class="ai-model-tab__error">{{ loadError }}</span>
      </ElFormItem>
      <ElFormItem label="Provider">
        <!-- e2e 契约：provider 下拉含 DeepSeek/GLM/通义 -->
        <ElSelect v-model="selectedProvider" placeholder="选择模型服务商" style="width: 240px">
          <ElOption v-for="p in providers" :key="p.value" :label="p.label" :value="p.value" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem>
        <ElButton type="primary" :loading="saving" :disabled="!selectedProvider" @click="handleSave">
          保存切换
        </ElButton>
        <span class="ai-model-tab__hint">切换经 BFF /api/ai/config 写回 AI 服务；服务只读或不可达时会提示失败。</span>
      </ElFormItem>
    </ElForm>
  </ElCard>
</template>

<script setup lang="ts">
/**
 * 设置页「AI 模型」Tab（e2e 契约 @J-ai-b-config：provider 可切换 DeepSeek/GLM/通义）。
 * 读：AI 服务 GET /ai/config（经 engine ai 客户端 /ai 反代）；
 * 写：BFF PUT /api/ai/config（鉴权反代；上游只读时如实报错，不造假成功）。
 */
import { onMounted, ref } from 'vue'
import { ElButton, ElCard, ElForm, ElFormItem, ElMessage, ElOption, ElSelect, ElTag } from 'element-plus'
import { getAiConfig, type AiConfig } from '@/api/ai'
import { request } from '@/api/request'

const providers = [
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '智谱 GLM', value: 'glm' },
  { label: '通义千问', value: 'qwen' },
]

const config = ref<AiConfig | null>(null)
const currentProvider = ref('')
const selectedProvider = ref('')
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')

onMounted(async () => {
  loading.value = true
  try {
    config.value = await getAiConfig()
    currentProvider.value = config.value?.model?.provider ?? ''
    selectedProvider.value = currentProvider.value
  } catch (e) {
    loadError.value = `AI 配置读取失败：${(e as Error).message}`
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  if (!selectedProvider.value) return
  saving.value = true
  try {
    await request.put('/api/ai/config', { provider: selectedProvider.value })
    ElMessage.success('AI provider 已切换')
  } catch (e) {
    ElMessage.error(`切换失败：${(e as Error).message}`)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ai-model-tab__hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ai-model-tab__error {
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
