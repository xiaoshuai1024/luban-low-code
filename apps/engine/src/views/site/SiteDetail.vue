<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElCard, ElDescriptions, ElDescriptionsItem, ElButton, ElTag } from 'element-plus'
import { getSite, type Site, type SiteAnalytics } from '@/api/site'
import AnalyticsConfig from './AnalyticsConfig.vue'
import { isFeatureEnabled } from '@/config/features'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string)
const site = ref<Site | null>(null)
const loading = ref(false)

/** V2-T10 分析埋点配置弹窗 */
const analyticsEnabled = isFeatureEnabled('analytics')
const analyticsDialogVisible = ref(false)

async function fetch() {
  if (!id.value) return
  loading.value = true
  try {
    const { data } = await getSite(id.value)
    site.value = data
  } catch {
    site.value = null
  } finally {
    loading.value = false
  }
}

function goPages() {
  router.push(`/sites/${id.value}/pages`)
}

/** 已配置的埋点平台摘要 */
function analyticsSummary(a?: SiteAnalytics): string {
  if (!a) return '未配置'
  const parts: string[] = []
  if (a.ga4?.measurementId) parts.push('GA4')
  if (a.baidu?.id) parts.push('百度统计')
  if (a.facebook?.pixelId) parts.push('FB Pixel')
  return parts.length ? parts.join('、') : '未配置'
}

function onAnalyticsSaved(a: SiteAnalytics) {
  if (site.value) site.value.analytics = a
}

onMounted(fetch)
</script>

<template>
  <div class="site-detail" v-loading="loading">
    <ElCard v-if="site" header="站点信息">
      <ElDescriptions :column="1" border>
        <ElDescriptionsItem label="名称">{{ site.name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="标识">{{ site.slug ?? '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="基础 URL">{{ site.baseUrl ?? '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="状态">{{ site.status ?? '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem v-if="analyticsEnabled" label="分析埋点">
          <ElTag size="small" :type="site.analytics ? 'success' : 'info'">
            {{ analyticsSummary(site.analytics) }}
          </ElTag>
        </ElDescriptionsItem>
      </ElDescriptions>
      <div style="margin-top: 16px; display: flex; gap: 8px">
        <ElButton type="primary" @click="goPages">进入页面列表</ElButton>
        <ElButton v-if="analyticsEnabled" @click="analyticsDialogVisible = true">分析埋点配置</ElButton>
      </div>
      <AnalyticsConfig
        v-if="analyticsEnabled"
        v-model="analyticsDialogVisible"
        :site-id="id"
        :analytics="site.analytics"
        @saved="onAnalyticsSaved"
      />
    </ElCard>
    <ElCard v-else>未找到站点</ElCard>
  </div>
</template>

<style lang="scss" scoped>
.site-detail {
  min-height: 200px;
}
</style>
