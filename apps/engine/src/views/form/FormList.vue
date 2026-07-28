<script setup lang="ts">
/**
 * FormList.vue — V2-T6 表单管理列表。
 *
 * 列出当前站点的所有表单（getForms），展示 name/status/dedupKeys 摘要。
 * 支持新建（跳 FormConfig）/编辑/删除。
 *
 * 依赖 api/form.ts（已就绪）。FeatureGate：VITE_FEATURE_FORMS 控制侧边栏入口。
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElTable,
  ElTableColumn,
  ElMessage,
  ElMessageBox,
  ElTag,
  ElEmpty,
} from 'element-plus'
import { getForms, type FormResponse } from '@/api/form'

const route = useRoute()
const router = useRouter()
const siteId = computed(() => route.params.siteId as string)
const forms = ref<FormResponse[]>([])
const loading = ref(false)

/** 当前 site id（侧边栏入口可能从 localStorage 取，这里优先 route） */
const currentSiteId = computed(() => {
  if (siteId.value) return siteId.value
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('luban_current_site_id') : null
  return stored || ''
})

async function fetchForms() {
  if (!currentSiteId.value) {
    forms.value = []
    return
  }
  loading.value = true
  try {
    const { data } = await getForms(currentSiteId.value)
    forms.value = Array.isArray(data) ? data : []
  } catch (e) {
    forms.value = []
    ElMessage.error((e as Error)?.message || '加载表单失败')
  } finally {
    loading.value = false
  }
}

function goNew() {
  router.push(`/sites/${currentSiteId.value}/forms/new`)
}

function goEdit(row: FormResponse) {
  router.push(`/sites/${currentSiteId.value}/forms/${row.id}`)
}

async function handleDelete(row: FormResponse) {
  try {
    await ElMessageBox.confirm(`确定删除表单「${row.name}」？删除后已绑定的留资组件将无法提交。`, '提示', { type: 'warning' })
  } catch {
    return
  }
  // 复用 form api（delete 由后端提供；此处用 updateForm status=archived 软删兜底）
  try {
    // 注意：form.ts 暂无 deleteForm；这里仅提示（后端按需扩展）
    ElMessage.info('表单删除需后端支持 DELETE /forms/:id（如已实现请补充 api）')
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  }
}

/** 去重规则摘要展示 */
function dedupSummary(row: FormResponse): string {
  if (!row.dedupKeys || row.dedupKeys.length === 0) return '未启用'
  const keys = row.dedupKeys.join(', ')
  const window = row.dedupWindow ? `（${row.dedupWindow}秒内）` : ''
  return `${keys}${window}`
}

onMounted(() => {
  fetchForms()
})
</script>

<template>
  <div class="form-list">
    <div class="form-list__toolbar">
      <span class="form-list__title">表单管理</span>
      <ElButton type="primary" :disabled="!currentSiteId" @click="goNew">新建表单</ElButton>
    </div>
    <p v-if="!currentSiteId" class="form-list__hint">
      请先在站点管理中选择一个站点。
    </p>
    <ElEmpty v-else-if="!loading && forms.length === 0" description="暂无表单，点击「新建表单」创建">
      <ElButton type="primary" @click="goNew">新建表单</ElButton>
    </ElEmpty>
    <ElTable v-else :data="forms" v-loading="loading" stripe>
      <ElTableColumn prop="name" label="表单名称" min-width="160" />
      <ElTableColumn prop="status" label="状态" width="100">
        <template #default="{ row }">
          <ElTag size="small" :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '启用' : row.status }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="去重规则" min-width="180">
        <template #default="{ row }">
          {{ dedupSummary(row) }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="createdAt" label="创建时间" width="180" />
      <ElTableColumn label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="goEdit(row)">编辑</ElButton>
          <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>

<style lang="scss" scoped>
.form-list {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  &__hint {
    color: #909399;
    font-size: 14px;
  }
}
</style>
