<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElTag,
  ElMessage,
  ElMessageBox,
  ElSkeleton,
  ElAlert,
} from 'element-plus'
import {
  getLead,
  updateLeadStatus,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_TRANSITIONS,
  type LeadResponse,
} from '@/api/lead'
import { formatDateTime } from '@/utils/datetime'
import { useUserStore } from '@/stores'
import { AxiosError } from 'axios'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const lead = ref<LeadResponse | null>(null)
const loading = ref(true)
const notFound = ref(false)
const noPermission = ref(false)
const transiting = ref(false)

const siteId = computed(() => (route.params.siteId as string) || '')
const leadId = computed(() => (route.params.id as string) || '')

const transitionTargets = computed(() => {
  if (!lead.value) return []
  return LEAD_STATUS_TRANSITIONS[lead.value.status] ?? []
})

async function fetchDetail() {
  loading.value = true
  notFound.value = false
  noPermission.value = false
  try {
    const { data } = await getLead(siteId.value, leadId.value)
    lead.value = data
  } catch (e) {
    const status = (e as AxiosError).response?.status
    if (status === 404) {
      notFound.value = true
    } else if (status === 403) {
      noPermission.value = true
    }
    lead.value = null
  } finally {
    loading.value = false
  }
}

async function handleTransit(targetStatus: string) {
  if (!lead.value) return
  const label = LEAD_STATUS_LABELS[targetStatus] ?? targetStatus
  const confirmMsg =
    targetStatus === 'converted'
      ? `确定将此线索标记为「${label}」？此操作通常不可撤销。`
      : `确定将线索状态变更为「${label}」？`

  try {
    await ElMessageBox.confirm(confirmMsg, '状态变更', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  transiting.value = true
  try {
    const actorId = userStore.token ?? undefined
    const { data } = await updateLeadStatus(siteId.value, leadId.value, {
      status: targetStatus,
      assigneeId: actorId,
    })
    lead.value = data
    ElMessage.success(`状态已变更为「${label}」`)
  } catch (e) {
    ElMessage.error((e as Error).message || '状态变更失败')
  } finally {
    transiting.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(fetchDetail)
</script>

<template>
  <div class="lead-detail">
    <!-- Header -->
    <div class="lead-detail__header">
      <ElButton @click="goBack">← 返回列表</ElButton>
      <h2 class="lead-detail__title">线索详情</h2>
    </div>

    <!-- Loading -->
    <ElSkeleton v-if="loading" :rows="6" animated />

    <!-- Not found -->
    <ElAlert
      v-if="notFound"
      title="线索不存在"
      type="warning"
      show-icon
      :closable="false"
    />

    <!-- No permission -->
    <ElAlert
      v-if="noPermission"
      title="权限不足"
      type="error"
      show-icon
      :closable="false"
      description="当前账号没有线索管理权限"
    />

    <!-- Detail card -->
    <template v-if="lead && !notFound && !noPermission">
      <ElCard class="lead-detail__card">
        <template #header>
          <div class="lead-detail__card-header">
            <span>联系人信息</span>
            <ElTag :type="(LEAD_STATUS_COLORS[lead.status] as any) || 'info'" size="small">
              {{ LEAD_STATUS_LABELS[lead.status] ?? lead.status }}
            </ElTag>
          </div>
        </template>
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem
            v-for="(val, key) in lead.contactMasked"
            :key="key"
            :label="key"
          >
            {{ val }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="来源表单">
            {{ lead.formName || lead.formId }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="渠道">
            {{ lead.utm?.source || lead.channelId || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="lead.utm?.campaign" label="活动">
            {{ lead.utm.campaign }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="来源 IP">
            {{ lead.sourceIp || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="创建时间">
            {{ formatDateTime(lead.createdAt) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="更新时间">
            {{ formatDateTime(lead.updatedAt) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="lead.convertedAt" label="转化时间">
            {{ formatDateTime(lead.convertedAt) }}
          </ElDescriptionsItem>
        </ElDescriptions>
      </ElCard>

      <!-- Status transitions -->
      <ElCard v-if="transitionTargets.length > 0" class="lead-detail__card">
        <template #header>
          <span>状态变更</span>
        </template>
        <div class="lead-detail__transitions">
          <ElButton
            v-for="target in transitionTargets"
            :key="target"
            :type="target === 'converted' ? 'success' : target === 'lost' || target === 'invalid' ? 'danger' : 'primary'"
            :loading="transiting"
            @click="handleTransit(target)"
          >
            {{ LEAD_STATUS_LABELS[target] ?? target }}
          </ElButton>
        </div>
      </ElCard>

      <!-- UTM info -->
      <ElCard v-if="lead.utm && Object.keys(lead.utm).length > 0" class="lead-detail__card">
        <template #header>
          <span>UTM 参数</span>
        </template>
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem
            v-for="(val, key) in lead.utm"
            :key="key"
            :label="key"
          >
            {{ val }}
          </ElDescriptionsItem>
        </ElDescriptions>
      </ElCard>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.lead-detail {
  max-width: 800px;
  margin: 0 auto;

  &__header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }

  &__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  &__card {
    margin-bottom: 20px;
  }

  &__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__transitions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
}
</style>
