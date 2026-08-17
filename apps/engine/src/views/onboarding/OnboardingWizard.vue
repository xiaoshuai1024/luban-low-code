<script setup lang="ts">
/**
 * OnboardingWizard.vue — 开通向导三步（signup-billing-onboarding §4.2.2/§4.3）。
 *
 * Step1 选套餐：三档卡（Free 默认选中，Starter 14 天试用角标）→「立即开通（¥0）」
 *   POST /api/billing/orders → ElResult success「支付成功 · 套餐已开通」1.5s 自动进 Step2；
 * Step2 建首站：SiteForm（slug 防抖预检）→ POST /api/sites → 409 内联 / 429 配额 ElAlert；
 * Step3 选模板：TemplateSelect → POST /api/sites/:sid/pages（首页 /）→ 跳设计器。
 *
 * 顶部 ElSteps 三步；已完成步可点回退（回退不撤销已开通订单，仅重做后续步）。
 * 四态：加载=骨架卡；错=ElResult error+重试 / 内联 / ElAlert；成功=自动进下一步。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElAlert,
  ElButton,
  ElCard,
  ElResult,
  ElStep,
  ElSteps,
  ElMessage,
} from 'element-plus'
import { getPlans, createOrder, type Plan } from '@/api/billing'
import { createSite } from '@/api/site'
import { createPage } from '@/api/page'
import { extractApiError } from '@/api/request'
import { getTemplate, TEMPLATES } from '@/config/templates'
import PlanPicker from './components/PlanPicker.vue'
import SiteForm, { type SiteFormValue } from './components/SiteForm.vue'
import TemplateSelect from './components/TemplateSelect.vue'

const router = useRouter()

const step = ref(1)

// === Step1：套餐 ===
const plans = ref<Plan[]>([])
const plansLoading = ref(true)
const plansError = ref('')
const selectedPlanCode = ref('')
const ordering = ref(false)
/** 0 元订单支付成功反馈（1.5s 后自动进 Step2） */
const paidSuccess = ref(false)

const selectedPlan = computed(
  () => plans.value.find((p) => p.planCode === selectedPlanCode.value) ?? null,
)

async function loadPlans(): Promise<void> {
  plansLoading.value = true
  plansError.value = ''
  try {
    const { data } = await getPlans()
    const list = Array.isArray(data) ? data : []
    if (list.length === 0) {
      // 空 = 异常兜底（§4.2.2-1）
      plansError.value = '获取套餐失败，请稍后重试'
      plans.value = []
      return
    }
    plans.value = list
    if (!list.some((p) => p.planCode === selectedPlanCode.value)) {
      // Free 默认选中（§4.3）
      selectedPlanCode.value = list.find((p) => p.planCode === 'free')?.planCode ?? list[0].planCode
    }
  } catch (e) {
    plans.value = []
    plansError.value = extractApiError(e).message || '获取套餐失败，请稍后重试'
  } finally {
    plansLoading.value = false
  }
}

async function confirmPlan(): Promise<void> {
  if (!selectedPlanCode.value || ordering.value) return
  ordering.value = true
  try {
    await createOrder(selectedPlanCode.value)
    paidSuccess.value = true
    setTimeout(() => {
      paidSuccess.value = false
      step.value = 2
    }, 1500)
  } catch (e) {
    const api = extractApiError(e)
    if (api.code === 'INVALID_PLAN') {
      ElMessage.error('套餐信息已更新，请重新选择')
      loadPlans()
    } else {
      ElMessage.error(api.message)
    }
  } finally {
    ordering.value = false
  }
}

// === Step2：建站 ===
const siteFormRef = ref<InstanceType<typeof SiteForm> | null>(null)
const siteForm = ref<SiteFormValue>({ name: '', slug: '' })
const creatingSite = ref(false)
const quotaError = ref('')

async function createFirstSite(): Promise<void> {
  if (creatingSite.value) return
  quotaError.value = ''
  if (!siteFormRef.value?.validate()) return
  creatingSite.value = true
  try {
    const { data } = await createSite({
      name: siteForm.value.name.trim(),
      slug: siteForm.value.slug,
      status: 'active',
    })
    siteId.value = data.id
    step.value = 3
  } catch (e) {
    const api = extractApiError(e)
    if (api.code === 'SLUG_TAKEN') {
      siteFormRef.value?.setSlugError('该站点地址已被占用，请更换')
    } else if (api.code === 'QUOTA_EXCEEDED') {
      quotaError.value = '套餐页面数已达上限，请升级套餐'
    } else {
      ElMessage.error(api.message)
    }
  } finally {
    creatingSite.value = false
  }
}

// === Step3：模板建首页 ===
const siteId = ref<string | null>(null)
const selectedTemplate = ref(TEMPLATES[0]?.id ?? 'blank')
const creatingPage = ref(false)

async function createHomePage(): Promise<void> {
  if (!siteId.value || creatingPage.value) return
  creatingPage.value = true
  try {
    const tpl = getTemplate(selectedTemplate.value) ?? TEMPLATES[0]
    const { data } = await createPage(siteId.value, {
      name: '首页',
      path: '/',
      schema: tpl?.schema,
    })
    router.replace(`/designer/sites/${siteId.value}/pages/${data.id}`)
  } catch (e) {
    // 失败 → 停留本步可重试（§4.2.2-5）
    ElMessage.error(extractApiError(e).message || '创建首页失败，请重试')
  } finally {
    creatingPage.value = false
  }
}

/** 已完成步可回退（回退不撤销订单，仅重做后续步） */
function goStep(target: number): void {
  if (target < step.value) {
    if (target <= 2) quotaError.value = ''
    step.value = target
  }
}

onMounted(loadPlans)
</script>

<template>
  <div class="onboarding">
    <div class="onboarding__wrap">
      <h1 class="onboarding__title">开通服务</h1>
      <p class="onboarding__subtitle">三步开通你的第一个站点：选套餐 → 创建站点 → 选择模板</p>

      <ElSteps :active="step - 1" align-center class="onboarding__steps" finish-status="success">
        <ElStep title="选套餐" @click="goStep(1)" />
        <ElStep title="创建站点" @click="goStep(2)" />
        <ElStep title="选择模板" />
      </ElSteps>

      <ElCard shadow="never" class="onboarding__content">
        <!-- Step1 选套餐 -->
        <template v-if="step === 1">
          <ElResult
            v-if="paidSuccess"
            icon="success"
            title="支付成功 · 套餐已开通"
            sub-title="正在进入下一步…"
          />
          <ElResult v-else-if="plansError" icon="error" :title="plansError">
            <template #extra>
              <ElButton type="primary" @click="loadPlans">重试</ElButton>
            </template>
          </ElResult>
          <template v-else>
            <PlanPicker v-model="selectedPlanCode" :plans="plans" :loading="plansLoading" />
            <div class="onboarding__actions">
              <ElButton
                type="primary"
                size="large"
                :loading="ordering"
                :disabled="!selectedPlanCode"
                @click="confirmPlan"
              >
                立即开通（¥{{ (selectedPlan?.priceMonthly ?? 0) / 100 }}）
              </ElButton>
            </div>
          </template>
        </template>

        <!-- Step2 创建站点 -->
        <template v-else-if="step === 2">
          <ElAlert
            v-if="quotaError"
            :title="quotaError"
            type="warning"
            show-icon
            :closable="false"
            class="onboarding__alert"
          />
          <SiteForm ref="siteFormRef" v-model="siteForm" :submitting="creatingSite" />
          <div class="onboarding__actions">
            <ElButton size="large" @click="goStep(1)">上一步</ElButton>
            <ElButton type="primary" size="large" :loading="creatingSite" @click="createFirstSite">
              创建站点
            </ElButton>
          </div>
        </template>

        <!-- Step3 选择模板 -->
        <template v-else>
          <TemplateSelect v-model="selectedTemplate" />
          <div class="onboarding__actions">
            <ElButton size="large" @click="goStep(2)">上一步</ElButton>
            <ElButton
              type="primary"
              size="large"
              :loading="creatingPage"
              :disabled="!siteId"
              @click="createHomePage"
            >
              开始编辑
            </ElButton>
          </div>
        </template>
      </ElCard>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.onboarding {
  min-height: 100vh;
  padding: 40px 20px;
  box-sizing: border-box;
  background: #f0f2f5;
}

.onboarding__wrap {
  max-width: 960px;
  margin: 0 auto;
}

.onboarding__title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}

.onboarding__subtitle {
  margin: 0 0 24px;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.onboarding__steps {
  margin-bottom: 24px;
  background: transparent;

  // 已完成步可点回退（ElStep 根节点透传 click）
  :deep(.el-step) {
    cursor: pointer;
  }
}

.onboarding__content {
  min-height: 320px;
}

.onboarding__alert {
  margin-bottom: 16px;
}

.onboarding__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
</style>
