<script setup lang="ts">
/**
 * AnalyticsConfig.vue — V2-T10 站点级分析埋点配置。
 *
 * 配置 GA4 / 百度统计 / Facebook Pixel；保存调 updateSite({ analytics })。
 * 在 SiteDetail 弹出（Dialog）。
 */
import { ref, computed, watch } from 'vue'
import {
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElButton,
  ElMessage,
  ElDivider,
} from 'element-plus'
import { updateSite, type SiteAnalytics } from '@/api/site'

const props = defineProps<{
  modelValue: boolean
  siteId: string
  analytics?: SiteAnalytics
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved', analytics: SiteAnalytics): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const form = ref<SiteAnalytics>({})
const saving = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.value = {
        ga4: props.analytics?.ga4 ? { ...props.analytics.ga4 } : undefined,
        baidu: props.analytics?.baidu ? { ...props.analytics.baidu } : undefined,
        facebook: props.analytics?.facebook ? { ...props.analytics.facebook } : undefined,
      }
    }
  }
)

async function handleSave() {
  // 清理空值
  const out: SiteAnalytics = {}
  if (form.value.ga4?.measurementId) out.ga4 = { measurementId: form.value.ga4.measurementId.trim() }
  if (form.value.baidu?.id) out.baidu = { id: form.value.baidu.id.trim() }
  if (form.value.facebook?.pixelId) out.facebook = { pixelId: form.value.facebook.pixelId.trim() }

  saving.value = true
  try {
    await updateSite(props.siteId, { analytics: out })
    ElMessage.success('分析配置已保存')
    emit('saved', out)
    visible.value = false
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ElDialog v-model="visible" title="分析埋点配置" width="520px">
    <ElForm label-position="top">
      <ElDivider content-position="left">Google Analytics 4</ElDivider>
      <ElFormItem label="Measurement ID">
        <ElInput
          :model-value="form.ga4?.measurementId ?? ''"
          placeholder="G-XXXXXXXXXX"
          @update:model-value="(v: string) => form.ga4 = { measurementId: v }"
        />
      </ElFormItem>

      <ElDivider content-position="left">百度统计</ElDivider>
      <ElFormItem label="统计 ID">
        <ElInput
          :model-value="form.baidu?.id ?? ''"
          placeholder="百度统计 hm.js 的 id（如 a1b2c3d4...）"
          @update:model-value="(v: string) => form.baidu = { id: v }"
        />
      </ElFormItem>

      <ElDivider content-position="left">Facebook Pixel</ElDivider>
      <ElFormItem label="Pixel ID">
        <ElInput
          :model-value="form.facebook?.pixelId ?? ''"
          placeholder="数字 Pixel ID（如 1234567890）"
          @update:model-value="(v: string) => form.facebook = { pixelId: v }"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>
