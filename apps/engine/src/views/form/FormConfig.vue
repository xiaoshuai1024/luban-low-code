<script setup lang="ts">
/**
 * FormConfig.vue — V2-T6 表单配置（去重规则 + 防刷）。
 *
 * 可视化配置：
 *  - 基础：name / status
 *  - 去重规则：dedupKeys（字段多选，如 phone/email）/ dedupWindow（时间窗秒数）/ dedupPolicy（reject/merge）
 *  - 防刷：antiSpam（IP 限流 / 验证码 / 最小提交间隔）
 *  - 字段定义：fieldSchema（JSON 编辑，定义表单字段）
 *
 * 保存调 updateForm / createForm。FeatureGate：VITE_FEATURE_FORMS。
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElSwitch,
  ElButton,
  ElCard,
  ElMessage,
  ElTag,
} from 'element-plus'
import { getForm, createForm, updateForm, type FormSavePayload } from '@/api/form'

const route = useRoute()
const router = useRouter()
const siteId = computed(() => route.params.siteId as string)
const formId = computed(() => route.params.id as string)
const isNew = computed(() => route.name === 'FormNew' || !formId.value)

const form = ref<{
  name: string
  status: string
  dedupKeys: string[]
  dedupWindow: number
  dedupPolicy: string
  antiSpam: Record<string, unknown>
  fieldSchema: Record<string, unknown>
  submitConfig: Record<string, unknown>
}>({
  name: '',
  status: 'active',
  dedupKeys: [],
  dedupWindow: 3600,
  dedupPolicy: 'reject',
  antiSpam: {},
  fieldSchema: {},
  submitConfig: {},
})

const saving = ref(false)
const loading = ref(false)

/** 常见字段候选（dedupKeys 多选用） */
const FIELD_OPTIONS = [
  { label: '手机号 (phone)', value: 'phone' },
  { label: '邮箱 (email)', value: 'email' },
  { label: '姓名 (name)', value: 'name' },
  { label: '公司 (company)', value: 'company' },
]

/** fieldSchema JSON 文本（双向） */
const fieldSchemaText = computed<string>({
  get() {
    try {
      return JSON.stringify(form.value.fieldSchema, null, 2)
    } catch {
      return '{}'
    }
  },
  set(v: string) {
    try {
      form.value.fieldSchema = JSON.parse(v)
    } catch {
      // 保留正在编辑的非法 JSON，不覆盖
    }
  },
})

async function loadForm() {
  if (isNew.value || !formId.value || !siteId.value) return
  loading.value = true
  try {
    const { data } = await getForm(siteId.value, formId.value)
    form.value.name = data.name
    form.value.status = data.status
    form.value.dedupKeys = data.dedupKeys ?? []
    form.value.dedupWindow = data.dedupWindow ?? 3600
    form.value.dedupPolicy = data.dedupPolicy ?? 'reject'
    form.value.antiSpam = data.antiSpam ?? {}
    form.value.fieldSchema = data.fieldSchema ?? {}
    form.value.submitConfig = data.submitConfig ?? {}
  } catch (e) {
    ElMessage.error((e as Error)?.message || '加载表单失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!form.value.name) {
    ElMessage.warning('请填写表单名称')
    return
  }
  if (!siteId.value) {
    ElMessage.warning('缺少站点 ID')
    return
  }
  saving.value = true
  try {
    const payload: FormSavePayload = {
      siteId: siteId.value,
      name: form.value.name,
      fieldSchema: form.value.fieldSchema,
      submitConfig: form.value.submitConfig,
      dedupKeys: form.value.dedupKeys,
      dedupWindow: form.value.dedupWindow,
      dedupPolicy: form.value.dedupPolicy,
      antiSpam: form.value.antiSpam,
      status: form.value.status,
    }
    if (isNew.value) {
      const { data } = await createForm(payload)
      ElMessage.success('创建成功')
      router.replace(`/sites/${siteId.value}/forms/${data.id}`)
    } else {
      await updateForm(siteId.value, formId.value, payload)
      ElMessage.success('保存成功')
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push(`/sites/${siteId.value}/forms`)
}

onMounted(() => {
  loadForm()
})
</script>

<template>
  <div class="form-config" v-loading="loading">
    <div class="form-config__toolbar">
      <ElButton text @click="goBack">← 返回表单列表</ElButton>
      <span class="form-config__title">{{ isNew ? '新建表单' : '编辑表单' }}</span>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </div>

    <ElCard shadow="never" class="form-config__section">
      <template #header><span class="form-config__section-title">基础信息</span></template>
      <ElForm label-position="top" size="default">
        <ElFormItem label="表单名称">
          <ElInput v-model="form.name" placeholder="如：官网留资表单" style="max-width: 400px" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSelect v-model="form.status" style="width: 160px">
            <ElOption label="启用" value="active" />
            <ElOption label="停用" value="inactive" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never" class="form-config__section">
      <template #header><span class="form-config__section-title">去重规则</span></template>
      <p class="form-config__desc">
        按指定字段（如手机号）在时间窗口内去重，避免同一线索重复入库。
      </p>
      <ElForm label-position="top" size="default">
        <ElFormItem label="去重字段">
          <ElSelect
            v-model="form.dedupKeys"
            multiple
            placeholder="选择去重字段（如 phone）"
            style="max-width: 400px"
          >
            <ElOption v-for="opt in FIELD_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </ElSelect>
          <div v-if="form.dedupKeys.length" class="form-config__tags">
            <ElTag v-for="k in form.dedupKeys" :key="k" size="small" closable @close="form.dedupKeys = form.dedupKeys.filter(x => x !== k)">{{ k }}</ElTag>
          </div>
        </ElFormItem>
        <ElFormItem label="去重时间窗（秒）">
          <ElInputNumber v-model="form.dedupWindow" :min="0" :step="3600" style="width: 200px" />
          <span class="form-config__hint">默认 3600 秒（1 小时）；0 = 永久去重</span>
        </ElFormItem>
        <ElFormItem label="冲突策略">
          <ElSelect v-model="form.dedupPolicy" style="width: 200px">
            <ElOption label="拒绝（reject）— 重复提交直接丢弃" value="reject" />
            <ElOption label="合并（merge）— 更新已有线索字段" value="merge" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never" class="form-config__section">
      <template #header><span class="form-config__section-title">防刷设置</span></template>
      <ElForm label-position="top" size="default">
        <ElFormItem label="IP 限流（次/分钟）">
          <ElInputNumber
            :model-value="Number(form.antiSpam.ipRateLimit ?? 10)"
            :min="0"
            style="width: 200px"
            @update:model-value="(v?: number) => form.antiSpam = { ...form.antiSpam, ipRateLimit: v ?? 0 }"
          />
        </ElFormItem>
        <ElFormItem label="最小提交间隔（秒）">
          <ElInputNumber
            :model-value="Number(form.antiSpam.minInterval ?? 5)"
            :min="0"
            style="width: 200px"
            @update:model-value="(v?: number) => form.antiSpam = { ...form.antiSpam, minInterval: v ?? 0 }"
          />
        </ElFormItem>
        <ElFormItem label="启用验证码">
          <ElSwitch
            :model-value="Boolean(form.antiSpam.captcha)"
            @update:model-value="(v: string | number | boolean) => form.antiSpam = { ...form.antiSpam, captcha: Boolean(v) }"
          />
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never" class="form-config__section">
      <template #header><span class="form-config__section-title">字段定义（JSON）</span></template>
      <ElInput
        v-model="fieldSchemaText"
        type="textarea"
        :autosize="{ minRows: 6, maxRows: 20 }"
        placeholder='{"fields":[{"name":"phone","label":"手机号","type":"tel","required":true}]}'
      />
    </ElCard>
  </div>
</template>

<style lang="scss" scoped>
.form-config {
  max-width: 800px;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    flex: 1;
  }

  &__section {
    margin-bottom: 16px;
  }

  &__section-title {
    font-size: 14px;
    font-weight: 600;
  }

  &__desc {
    font-size: 13px;
    color: #909399;
    margin: 0 0 12px;
  }

  &__hint {
    font-size: 12px;
    color: #909399;
    margin-left: 8px;
  }

  &__tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
}
</style>
