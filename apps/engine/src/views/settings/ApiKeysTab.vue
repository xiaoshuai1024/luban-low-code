<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  ElCard,
  ElInput,
  ElButton,
  ElTable,
  ElTableColumn,
  ElTag,
  ElDialog,
  ElPopconfirm,
  ElMessage,
  ElSkeleton,
  ElAlert,
  ElDatePicker,
} from 'element-plus'
import { listApiKeys, createApiKey, revokeApiKey, type ApiKey } from '@/api/api-keys'

const loading = ref(false)
const creating = ref(false)
const error = ref('')
const keys = ref<ApiKey[]>([])

const newName = ref('')
const newExpiresAt = ref<string | undefined>(undefined)

const createdKeyDialogVisible = ref(false)
const createdKeyValue = ref('')
const createdKeyName = ref('')

const deleting = ref<Record<string, boolean>>({})

async function fetchKeys() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await listApiKeys()
    keys.value = data.list || []
  } catch (e) {
    error.value = (e as Error).message || '加载 API Key 列表失败'
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!newName.value.trim()) {
    ElMessage.warning('请输入 API Key 名称')
    return
  }
  creating.value = true
  try {
    const { data } = await createApiKey({
      name: newName.value.trim(),
      expiresAt: newExpiresAt.value || undefined,
    })
    createdKeyValue.value = data.key || ''
    createdKeyName.value = data.name
    createdKeyDialogVisible.value = true
    newName.value = ''
    newExpiresAt.value = undefined
    await fetchKeys()
  } catch (e) {
    ElMessage.error((e as Error).message || '创建 API Key 失败')
  } finally {
    creating.value = false
  }
}

async function handleRevoke(id: string) {
  deleting.value[id] = true
  try {
    await revokeApiKey(id)
    ElMessage.success('已撤销该 API Key')
    await fetchKeys()
  } catch (e) {
    ElMessage.error((e as Error).message || '撤销失败')
  } finally {
    deleting.value[id] = false
  }
}

async function handleCopy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

function formatTime(time?: string): string {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

onMounted(fetchKeys)
</script>

<template>
  <div class="api-keys-tab">
    <!-- Title & description -->
    <h3 class="api-keys-tab__title">API Key 管理</h3>
    <p class="api-keys-tab__desc">API Key 用于 MCP Agent 鉴权，创建后请妥善保管</p>

    <!-- Creation section -->
    <ElCard shadow="never" class="api-keys-tab__create">
      <div class="api-keys-tab__create-form">
        <ElInput
          v-model="newName"
          placeholder="请输入 Key 名称"
          style="width: 260px"
          clearable
        />
        <ElDatePicker
          v-model="newExpiresAt"
          type="date"
          placeholder="过期时间（可选）"
          value-format="x"
          style="width: 180px"
          clearable
        />
        <ElButton type="primary" :loading="creating" @click="handleCreate">
          创建 Key
        </ElButton>
      </div>
    </ElCard>

    <!-- Error state -->
    <ElAlert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      closable
      class="api-keys-tab__error"
    />

    <!-- Loading state -->
    <ElCard shadow="never" v-if="loading" class="api-keys-tab__table">
      <ElSkeleton :rows="4" animated />
    </ElCard>

    <!-- Table -->
    <ElCard shadow="never" v-else class="api-keys-tab__table">
      <ElTable :data="keys" stripe style="width: 100%" v-if="keys.length">
        <ElTableColumn prop="name" label="名称" min-width="140" />
        <ElTableColumn prop="prefix" label="前缀" min-width="120" />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '启用' : '已撤销' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="最后使用时间" min-width="160">
          <template #default="{ row }">
            {{ formatTime(row.lastUsedAt) }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="过期时间" min-width="160">
          <template #default="{ row }">
            {{ formatTime(row.expiresAt) }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElPopconfirm
              v-if="row.status === 'active'"
              title="确定要撤销此 Key 吗？撤销后使用该 Key 的 MCP Server 将无法访问"
              @confirm="handleRevoke(row.id)"
            >
              <template #reference>
                <ElButton
                  type="danger"
                  size="small"
                  :loading="deleting[row.id]"
                >
                  撤销
                </ElButton>
              </template>
            </ElPopconfirm>
            <span v-else class="api-keys-tab__revoked-label">-</span>
          </template>
        </ElTableColumn>
      </ElTable>

      <!-- Empty state -->
      <div v-else class="api-keys-tab__empty">
        <p>暂无 API Key，请创建一个</p>
      </div>
    </ElCard>

    <!-- Created key dialog -->
    <ElDialog
      v-model="createdKeyDialogVisible"
      title="API Key 已创建"
      width="520px"
      :close-on-click-modal="false"
    >
      <div class="api-keys-tab__dialog-body">
        <ElAlert
          title="请立即复制此 Key，关闭后将不再显示"
          type="warning"
          show-icon
          :closable="false"
        />
        <div class="api-keys-tab__key-display">
          <code class="api-keys-tab__key-text">{{ createdKeyValue }}</code>
          <ElButton
            type="primary"
            size="small"
            @click="handleCopy(createdKeyValue)"
          >
            复制
          </ElButton>
        </div>
      </div>
      <template #footer>
        <ElButton @click="createdKeyDialogVisible = false">关闭</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style lang="scss" scoped>
.api-keys-tab {
  &__title {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 600;
  }

  &__desc {
    margin: 0 0 16px;
    font-size: 13px;
    color: #909399;
  }

  &__create {
    margin-bottom: 16px;
  }

  &__create-form {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  &__error {
    margin-bottom: 16px;
  }

  &__table {
    min-height: 120px;
  }

  &__empty {
    padding: 40px 0;
    text-align: center;
    color: #909399;
    font-size: 14px;
  }

  &__revoked-label {
    color: #c0c4cc;
  }

  &__dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__key-display {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__key-text {
    flex: 1;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 13px;
    word-break: break-all;
    user-select: all;
  }
}
</style>
