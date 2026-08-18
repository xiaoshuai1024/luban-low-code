<script setup lang="ts">
/**
 * UserPlanPanel.vue — 用户菜单套餐+用量分组（signup-billing-onboarding §4.2.3/§9.5）。
 *
 * props {plan?, usage?, loading?}：未传 plan/usage 时组件自取（getMyPlan/getUsage）；
 * 两路加载独立失败 → 对应分组显示「—」，不阻断菜单其余内容。
 * 暴露 refresh()：DefaultLayout 在 dropdown 打开时调用重拉（数据新鲜度，R2）。
 * dict-tag 中文：生效中/试用中/已过期；ElProgress 两条（页面数、本月留资），limit=0 显示「不限」。
 */
import { computed, onMounted, ref } from 'vue'
import { ElProgress, ElTag } from 'element-plus'
import { getMyPlan, getUsage, type Subscription, type Usage, type UsageMetrics } from '@/api/billing'

const props = defineProps<{
  plan?: Subscription
  usage?: Usage
  loading?: boolean
}>()

const selfPlan = ref<Subscription | null>(null)
const selfUsage = ref<Usage | null>(null)
/** 两路独立失败标记（显「—」不阻断） */
const planFailed = ref(false)
const usageFailed = ref(false)
/** refresh() 进行中（dropdown 打开重拉时面板 v-loading） */
const refreshing = ref(false)

/** 自取数据（onMounted 初次与 refresh 重拉共用；props 注入的路跳过对应分支） */
async function loadSelf(): Promise<void> {
  if (!props.plan) {
    planFailed.value = false
    try {
      const { data } = await getMyPlan()
      selfPlan.value = data
    } catch {
      selfPlan.value = null
      planFailed.value = true
    }
  }
  if (!props.usage && !selfPlan.value?.usage) {
    usageFailed.value = false
    try {
      const { data } = await getUsage()
      selfUsage.value = data
    } catch {
      selfUsage.value = null
      usageFailed.value = true
    }
  }
}

/**
 * 重拉套餐/用量：DefaultLayout 在用户菜单 dropdown 打开（visible-change=true）时调用，
 * 保证每次展开看到的是最新套餐/用量，而非首屏挂载时的快照。
 */
async function refresh(): Promise<void> {
  refreshing.value = true
  try {
    await loadSelf()
  } finally {
    refreshing.value = false
  }
}

onMounted(loadSelf)
defineExpose({ refresh })

const plan = computed<Subscription | null>(() => props.plan ?? selfPlan.value)

const usageMetrics = computed<UsageMetrics | null>(
  () => props.usage ?? selfPlan.value?.usage ?? selfUsage.value ?? null,
)

const STATUS_TEXT: Record<string, string> = {
  active: '生效中',
  trialing: '试用中',
  expired: '已过期',
}
const STATUS_TAG: Record<string, 'success' | 'warning' | 'info'> = {
  active: 'success',
  trialing: 'warning',
  expired: 'info',
}

const statusText = computed(() => STATUS_TEXT[plan.value?.status ?? ''] ?? '—')
const statusTag = computed(() => STATUS_TAG[plan.value?.status ?? 'active'] ?? 'info')

/** 配额语义（§3.4）：0 = 不限；plan 未知（null/未带 quota）→「—」，不冒充不限 */
function limitText(limit?: number): string {
  if (limit === undefined) return '—'
  return limit > 0 ? String(limit) : '不限'
}

function percentOf(used: number, limit?: number): number {
  if (!limit || limit <= 0) return 0
  return Math.min(Math.round((used / limit) * 100), 100)
}

/** 超限/达限 → 警示色（ElProgress exception） */
function statusOf(used: number, limit?: number): 'exception' | undefined {
  if (limit && limit > 0 && used >= limit) return 'exception'
  return undefined
}

const pagesPercent = computed(() =>
  percentOf(usageMetrics.value?.pages ?? 0, plan.value?.quota?.pages),
)
const leadsPercent = computed(() =>
  percentOf(usageMetrics.value?.leads ?? 0, plan.value?.quota?.leads),
)
</script>

<template>
  <div class="user-plan-panel" v-loading="loading || refreshing">
    <div class="user-plan-panel__row">
      <span class="user-plan-panel__label">当前套餐</span>
      <template v-if="plan">
        <span class="user-plan-panel__name">{{ plan.planName || plan.planCode }}</span>
        <ElTag size="small" :type="statusTag" effect="light">{{ statusText }}</ElTag>
      </template>
      <span v-else class="user-plan-panel__fallback">—</span>
    </div>

    <template v-if="usageMetrics">
      <div class="user-plan-panel__metric">
        <div class="user-plan-panel__metric-head">
          <span>页面数</span>
          <span class="user-plan-panel__metric-num">
            {{ usageMetrics.pages }} / {{ limitText(plan?.quota?.pages) }}
          </span>
        </div>
        <ElProgress
          :percentage="pagesPercent"
          :status="statusOf(usageMetrics.pages, plan?.quota?.pages)"
          :stroke-width="8"
          :show-text="false"
        />
      </div>
      <div class="user-plan-panel__metric">
        <div class="user-plan-panel__metric-head">
          <span>本月留资</span>
          <span class="user-plan-panel__metric-num">
            {{ usageMetrics.leads }} / {{ limitText(plan?.quota?.leads) }}
          </span>
        </div>
        <ElProgress
          :percentage="leadsPercent"
          :status="statusOf(usageMetrics.leads, plan?.quota?.leads)"
          :stroke-width="8"
          :show-text="false"
        />
      </div>
    </template>
    <div v-else class="user-plan-panel__row">
      <span class="user-plan-panel__label">用量</span>
      <span class="user-plan-panel__fallback">—</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.user-plan-panel {
  width: 220px;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-plan-panel__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.user-plan-panel__label {
  color: #909399;
}

.user-plan-panel__name {
  font-weight: 600;
  color: #303133;
}

.user-plan-panel__fallback {
  color: #c0c4cc;
}

.user-plan-panel__metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-plan-panel__metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #606266;
}

.user-plan-panel__metric-num {
  color: #909399;
}
</style>
