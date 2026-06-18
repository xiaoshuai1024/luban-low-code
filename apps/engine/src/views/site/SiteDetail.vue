<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElCard, ElDescriptions, ElDescriptionsItem, ElButton } from 'element-plus'
import { getSite, type Site } from '@/api/site'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string)
const site = ref<Site | null>(null)
const loading = ref(false)

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
      </ElDescriptions>
      <div style="margin-top: 16px">
        <ElButton type="primary" @click="goPages">进入页面列表</ElButton>
      </div>
    </ElCard>
    <ElCard v-else>未找到站点</ElCard>
  </div>
</template>

<style lang="scss" scoped>
.site-detail {
  min-height: 200px;
}
</style>
