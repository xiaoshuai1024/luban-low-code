<script setup lang="ts">
/**
 * PlanPicker.vue — 开通向导 Step1 套餐选择卡（signup-billing-onboarding §4.2.2/§9.5）。
 *
 * props {plans, modelValue, loading?}；点卡切换选中（update:modelValue = planCode）。
 * 每卡：套餐名 + ¥x/月 + 配额摘要（页面数/月留资，0=不限）+ 试用角标（trialDays>0）。
 * loading → 三张骨架卡（四态之「加载」）。
 */
import { computed } from 'vue'
import { ElSkeleton, ElTag } from 'element-plus'
import type { Plan } from '@/api/billing'

const props = defineProps<{
  plans: Plan[]
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const cards = computed(() => props.plans)

function quotaText(n: number): string {
  return n > 0 ? String(n) : '不限'
}

function priceText(p: Plan): string {
  return `¥${(p.priceMonthly ?? 0) / 100}`
}

function pick(planCode: string): void {
  emit('update:modelValue', planCode)
}
</script>

<template>
  <div class="plan-picker">
    <!-- 加载态：三张骨架卡 -->
    <div v-if="loading" class="plan-picker__grid">
      <div v-for="i in 3" :key="i" class="plan-picker__card is-skeleton">
        <ElSkeleton :rows="3" animated />
      </div>
    </div>

    <div v-else class="plan-picker__grid">
      <button
        v-for="plan in cards"
        :key="plan.planCode"
        type="button"
        class="plan-picker__card"
        :class="{ 'is-selected': plan.planCode === modelValue }"
        @click="pick(plan.planCode)"
      >
        <div class="plan-picker__head">
          <span class="plan-picker__name">{{ plan.name }}</span>
          <ElTag v-if="plan.trialDays && plan.trialDays > 0" type="warning" size="small" effect="light">
            {{ plan.trialDays }} 天试用
          </ElTag>
        </div>
        <div class="plan-picker__price">
          {{ priceText(plan) }}<span class="plan-picker__price-unit">/月</span>
        </div>
        <ul class="plan-picker__quota">
          <li>站点内页面数：{{ quotaText(plan.quotaPages) }}</li>
          <li>月留资数：{{ quotaText(plan.quotaLeads) }}</li>
        </ul>
        <span class="plan-picker__action" :class="{ 'is-active': plan.planCode === modelValue }">
          {{ plan.planCode === modelValue ? '已选择' : '选择' }}
        </span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.plan-picker__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .plan-picker__grid {
    grid-template-columns: 1fr;
  }
}

.plan-picker__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: #409eff;
  }

  &.is-selected {
    border-color: #409eff;
    box-shadow: 0 0 0 1px #409eff inset;
  }

  &.is-skeleton {
    cursor: default;
    min-height: 180px;
  }
}

.plan-picker__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plan-picker__name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.plan-picker__price {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.plan-picker__price-unit {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 400;
  color: #909399;
}

.plan-picker__quota {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.plan-picker__action {
  margin-top: 4px;
  font-size: 13px;
  color: #909399;

  &.is-active {
    color: #409eff;
    font-weight: 600;
  }
}
</style>
