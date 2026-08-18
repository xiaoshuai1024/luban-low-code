<script setup lang="ts">
/**
 * Billing.vue — 套餐与订单页（signup-billing-onboarding §4.2.4/§4.3）。
 *
 * 1. 当前订阅卡：plan 名称 + status dict-tag（生效中/试用中/已过期）+ 试用到期日；
 * 2. 三档对比表：行=能力（价格/页面数/月留资/试用），列=三档，当前档高亮；
 *    操作列「切换」= 0 元下单（createOrder），成功 toast 并刷新本页；
 * 3. 订单记录 ElTable（订单号/套餐/金额/状态 dict-tag/创建时间）+ 分页 10/页，空态「暂无订单」。
 * 四态：加载 v-loading；错=整页 ElResult error+重试（订阅/套餐失败）或表格区重试（订单失败）。
 */
import { computed, onMounted, ref } from 'vue'
import {
  ElButton,
  ElCard,
  ElPagination,
  ElResult,
  ElTable,
  ElTableColumn,
  ElTag,
  ElMessage,
} from 'element-plus'
import {
  createOrder,
  getMyPlan,
  getOrders,
  getPlans,
  type Order,
  type Plan,
  type Subscription,
} from '@/api/billing'
import { extractApiError } from '@/api/request'

const ORDERS_PAGE_SIZE = 10

const loading = ref(false)
const pageError = ref('')
const plans = ref<Plan[]>([])
const plan = ref<Subscription | null>(null)

const orders = ref<Order[]>([])
const ordersTotal = ref(0)
const ordersPage = ref(1)
const ordersLoading = ref(false)
const ordersError = ref(false)
/** 正在下单的套餐（操作列按钮 loading） */
const orderingPlanCode = ref('')

const planName = computed(() => plan.value?.planName || plan.value?.planCode || '—')

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
const ORDER_STATUS_TEXT: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
}
const ORDER_STATUS_TAG: Record<string, 'success' | 'warning' | 'info'> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'info',
}

const statusText = computed(() => STATUS_TEXT[plan.value?.status ?? ''] ?? '—')
const statusTag = computed(() => STATUS_TAG[plan.value?.status ?? 'active'] ?? 'info')

const trialText = computed(() => {
  if (!plan.value?.trialEndsAt) return '—'
  const d = new Date(plan.value.trialEndsAt)
  if (Number.isNaN(d.getTime())) return plan.value.trialEndsAt
  return d.toLocaleDateString('zh-CN')
})

/** 对比表行：能力 × 三档值（末行为操作：当前档「当前」/其余「切换」，§4.3） */
interface CompareRow {
  key: string
  label: string
  values: string[]
}

const compareRows = computed<CompareRow[]>(() => [
  {
    key: 'price',
    label: '价格',
    values: plans.value.map((p) => `${formatAmount(p.priceMonthly)}/月`),
  },
  {
    key: 'pages',
    label: '站点内页面数',
    values: plans.value.map((p) => (p.quotaPages > 0 ? String(p.quotaPages) : '不限')),
  },
  {
    key: 'leads',
    label: '月留资数',
    values: plans.value.map((p) => (p.quotaLeads > 0 ? String(p.quotaLeads) : '不限')),
  },
  {
    key: 'trial',
    label: '试用',
    values: plans.value.map((p) => (p.trialDays && p.trialDays > 0 ? `${p.trialDays} 天` : '—')),
  },
  { key: 'action', label: '操作', values: plans.value.map(() => '') },
])

function isCurrent(p: Plan): boolean {
  return !!plan.value && plan.value.planCode === p.planCode
}

function orderStatusText(status: string): string {
  return ORDER_STATUS_TEXT[status] ?? status
}

function orderStatusTag(status: string): 'success' | 'warning' | 'info' {
  return ORDER_STATUS_TAG[status] ?? 'info'
}

function formatAmount(amount: number): string {
  return `¥${((amount ?? 0) / 100).toFixed(2)}`
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function loadAll(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    const [plansRes, meRes] = await Promise.all([getPlans(), getMyPlan()])
    plans.value = Array.isArray(plansRes.data) ? plansRes.data : []
    plan.value = meRes.data
  } catch (e) {
    pageError.value = extractApiError(e).message || '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
  await loadOrders()
}

async function loadOrders(): Promise<void> {
  ordersLoading.value = true
  ordersError.value = false
  try {
    const { data } = await getOrders({ page: ordersPage.value, size: ORDERS_PAGE_SIZE })
    orders.value = Array.isArray(data?.items) ? data.items : []
    ordersTotal.value = data?.total ?? 0
  } catch {
    orders.value = []
    ordersTotal.value = 0
    ordersError.value = true
  } finally {
    ordersLoading.value = false
  }
}

function onPageChange(page: number): void {
  ordersPage.value = page
  loadOrders()
}

/** 切换套餐 = 0 元下单（同向导 Step1 链路），成功刷新本页 */
async function switchPlan(target: Plan): Promise<void> {
  if (orderingPlanCode.value) return
  orderingPlanCode.value = target.planCode
  try {
    await createOrder(target.planCode)
    ElMessage.success(`已切换至 ${target.name}`)
    // 新订单插到首页：回第 1 页再刷新，避免停留超界页码
    ordersPage.value = 1
    const [meRes] = await Promise.all([getMyPlan(), loadOrders()])
    plan.value = meRes.data
  } catch (e) {
    const api = extractApiError(e)
    if (api.code === 'INVALID_PLAN') {
      ElMessage.error('套餐信息已更新，请重试')
      loadAll()
    } else {
      ElMessage.error(api.message)
    }
  } finally {
    orderingPlanCode.value = ''
  }
}

/** 对比表当前档高亮（列） */
function cellClassName({ columnIndex }: { row: unknown; columnIndex: number }): string {
  if (columnIndex >= 1 && plans.value[columnIndex - 1] && isCurrent(plans.value[columnIndex - 1])) {
    return 'is-current-plan'
  }
  return ''
}

onMounted(loadAll)
</script>

<template>
  <div class="billing" v-loading="loading">
    <!-- 整页错误：订阅/套餐加载失败 -->
    <ElResult v-if="pageError" icon="error" :title="pageError">
      <template #extra>
        <ElButton type="primary" @click="loadAll">重试</ElButton>
      </template>
    </ElResult>

    <template v-else>
      <!-- 当前订阅卡 -->
      <ElCard shadow="never" class="billing__card">
        <template #header>当前订阅</template>
        <div class="billing__current">
          <span class="billing__current-plan">{{ planName }}</span>
          <ElTag :type="statusTag" effect="light">{{ statusText }}</ElTag>
          <span class="billing__current-trial">试用到期：{{ trialText }}</span>
        </div>
      </ElCard>

      <!-- 三档对比表 -->
      <ElCard shadow="never" class="billing__card">
        <template #header>套餐对比</template>
        <ElTable :data="compareRows" :cell-class-name="cellClassName" class="billing__compare">
          <ElTableColumn prop="label" label="能力" width="160" />
          <ElTableColumn
            v-for="(p, idx) in plans"
            :key="p.planCode"
            :label="p.name"
            align="center"
          >
            <template #header>
              <span class="billing__plan-head">
                {{ p.name }}
                <ElTag v-if="isCurrent(p)" size="small" effect="dark">当前</ElTag>
              </span>
            </template>
            <template #default="{ row }">
              <template v-if="(row as CompareRow).key === 'action'">
                <ElTag v-if="isCurrent(p)" type="info" effect="plain">当前</ElTag>
                <ElButton
                  v-else
                  type="primary"
                  size="small"
                  :loading="orderingPlanCode === p.planCode"
                  @click="switchPlan(p)"
                >
                  切换
                </ElButton>
              </template>
              <template v-else>
                {{ (row as CompareRow).values[idx] }}
              </template>
            </template>
          </ElTableColumn>
        </ElTable>
      </ElCard>

      <!-- 订单记录 -->
      <ElCard shadow="never" class="billing__card">
        <template #header>订单记录</template>
        <template v-if="ordersError">
          <ElResult icon="error" title="订单加载失败，请稍后重试">
            <template #extra>
              <ElButton type="primary" @click="loadOrders">重试</ElButton>
            </template>
          </ElResult>
        </template>
        <template v-else>
          <ElTable :data="orders" v-loading="ordersLoading">
            <ElTableColumn prop="orderNo" label="订单号" min-width="180" />
            <ElTableColumn prop="planCode" label="套餐" width="120">
              <template #default="{ row }">
                {{ plans.find((p) => p.planCode === (row as Order).planCode)?.name ?? (row as Order).planCode }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="金额" width="100">
              <template #default="{ row }">{{ formatAmount((row as Order).amount) }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="100">
              <template #default="{ row }">
                <ElTag :type="orderStatusTag((row as Order).status)" effect="light">
                  {{ orderStatusText((row as Order).status) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatDate((row as Order).createdAt) }}</template>
            </ElTableColumn>
            <template #empty>暂无订单</template>
          </ElTable>
          <div class="billing__pagination">
            <ElPagination
              layout="total, prev, pager, next"
              :total="ordersTotal"
              :page-size="ORDERS_PAGE_SIZE"
              :current-page="ordersPage"
              @current-change="onPageChange"
            />
          </div>
        </template>
      </ElCard>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.billing__card {
  margin-bottom: 20px;
}

.billing__current {
  display: flex;
  align-items: center;
  gap: 12px;
}

.billing__current-plan {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.billing__current-trial {
  font-size: 13px;
  color: #909399;
}

.billing__plan-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* 当前档高亮列 */
.billing__compare {
  :deep(.is-current-plan) {
    background: var(--el-color-primary-light-9, #ecf5ff);
  }
}

.billing__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
