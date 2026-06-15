<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElButton,
  ElTable,
  ElTableColumn,
  ElTag,
  ElPagination,
  ElInput,
  ElSelect,
  ElOption,
  ElMessage,
  ElMessageBox,
} from 'element-plus'
import {
  getLeads,
  exportLeadsCsv,
  updateLeadStatus,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_TRANSITIONS,
  type LeadResponse,
} from '@/api/lead'
import { getForms, type FormResponse } from '@/api/form'
import { formatDateTime } from '@/utils/datetime'
import { useUserStore } from '@/stores'
import { AxiosError } from 'axios'

const router = useRouter()
const userStore = useUserStore()

const list = ref<LeadResponse[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')
const filterFormId = ref('')
const keyword = ref('')

const forms = ref<FormResponse[]>([])
const siteId = ref('')

const noPermission = ref(false)

const hasTransitionTargets = computed(() => (status: string) =>
  (LEAD_STATUS_TRANSITIONS[status] ?? []).length > 0
)

async function fetchForms() {
  if (!siteId.value) return
  try {
    const { data } = await getForms(siteId.value)
    forms.value = data ?? []
  } catch {
    // forms fetch is non-critical
  }
}

async function fetchList() {
  if (!siteId.value) {
    ElMessage.warning('请先选择一个站点')
    return
  }
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      siteId: siteId.value,
      page: page.value,
      size: pageSize.value,
    }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterFormId.value) params.formId = filterFormId.value
    const { data } = await getLeads(params as any)
    list.value = data?.list ?? []
    total.value = data?.total ?? 0
    noPermission.value = false
  } catch (e) {
    const status = (e as AxiosError).response?.status
    if (status === 403) {
      noPermission.value = true
      ElMessage.error('当前账号没有线索管理权限')
    }
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function handleExport() {
  try {
    const res = await exportLeadsCsv(siteId.value)
    const blob = new Blob([res.data as BlobPart], { type: 'text/csv;charset=UTF-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${siteId.value}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
  }
}

async function handleTransitStatus(row: LeadResponse, targetStatus: string) {
  const label = LEAD_STATUS_LABELS[targetStatus] ?? targetStatus
  try {
    await ElMessageBox.confirm(
      `确定将线索从「${LEAD_STATUS_LABELS[row.status] ?? row.status}」变更为「${label}」？`,
      '状态变更',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
  } catch {
    return // user cancelled
  }

  try {
    const actorId = userStore.token ?? undefined
    await updateLeadStatus(siteId.value, row.id, {
      status: targetStatus,
      assigneeId: actorId,
    })
    ElMessage.success(`状态已变更为「${label}」`)
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '状态变更失败')
  }
}

function goDetail(row: LeadResponse) {
  router.push({
    name: 'LeadDetail',
    params: { siteId: siteId.value, id: row.id },
  })
}

function onPageChange(p: number) {
  page.value = p
  fetchList()
}

function onSizeChange(s: number) {
  pageSize.value = s
  page.value = 1
  fetchList()
}

function initSiteId() {
  // Try to get siteId from route query, store, or localStorage
  const stored = localStorage.getItem('luban_current_site_id')
  if (stored) {
    siteId.value = stored
  }
}

onMounted(() => {
  initSiteId()
  if (siteId.value) {
    fetchForms()
    fetchList()
  }
})
</script>

<template>
  <div class="lead-list">
    <div class="lead-list__header">
      <h2 class="lead-list__title">线索中心</h2>
    </div>

    <!-- Filter toolbar -->
    <div class="lead-list__toolbar">
      <ElSelect
        v-model="filterStatus"
        placeholder="线索状态"
        clearable
        style="width: 140px"
        @change="fetchList"
      >
        <ElOption
          v-for="(label, key) in LEAD_STATUS_LABELS"
          :key="key"
          :label="label"
          :value="key"
        />
      </ElSelect>
      <ElSelect
        v-model="filterFormId"
        placeholder="来源表单"
        clearable
        style="width: 180px"
        @change="fetchList"
      >
        <ElOption
          v-for="f in forms"
          :key="f.id"
          :label="f.name"
          :value="f.id"
        />
      </ElSelect>
      <ElInput
        v-model="keyword"
        placeholder="搜索联系人"
        clearable
        style="width: 200px"
        @keyup.enter="fetchList"
      />
      <ElButton type="primary" @click="fetchList">查询</ElButton>
      <ElButton @click="handleExport">导出 CSV</ElButton>
    </div>

    <!-- No site selected hint -->
    <ElAlert
      v-if="!siteId"
      title="请先选择站点"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <!-- No permission hint -->
    <ElAlert
      v-if="noPermission"
      title="权限不足"
      description="当前账号没有线索管理权限，请使用管理员账号登录"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <!-- Data table -->
    <ElTable :data="list" v-loading="loading" stripe @row-dblclick="goDetail">
      <ElTableColumn label="联系人" min-width="180">
        <template #default="{ row }">
          <div class="lead-list__contact">
            <span v-for="(val, key) in row.contactMasked" :key="key" class="lead-list__contact-item">
              {{ key }}: {{ val }}
            </span>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="formName" label="来源表单" min-width="120" />
      <ElTableColumn label="状态" width="100">
        <template #default="{ row }">
          <ElTag :type="(LEAD_STATUS_COLORS[row.status] as any) || 'info'" size="small">
            {{ LEAD_STATUS_LABELS[row.status] ?? row.status }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="渠道" width="100">
        <template #default="{ row }">
          {{ row.utm?.source || row.channelId || '-' }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="goDetail(row)">详情</ElButton>
          <template v-if="hasTransitionTargets(row.status)">
            <ElButton
              v-for="target in (LEAD_STATUS_TRANSITIONS[row.status] ?? [])"
              :key="target"
              link
              :type="target === 'converted' ? 'success' : 'primary'"
              @click="handleTransitStatus(row, target)"
            >
              {{ LEAD_STATUS_LABELS[target] }}
            </ElButton>
          </template>
        </template>
      </ElTableColumn>
    </ElTable>

    <!-- Pagination -->
    <ElPagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="lead-list__pagination"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.lead-list {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  &__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
  &__toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  &__contact {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  &__contact-item {
    font-size: 13px;
    color: #303133;
  }
  &__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
}
</style>
