<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElTable,
  ElTableColumn,
  ElMessage,
  ElMessageBox,
  ElTag,
} from 'element-plus'
import { getPages, deletePage, type PageMeta } from '@/api/page'
import { getSite, type Site } from '@/api/site'
import { buildPublishedPagePreviewUrl } from '@/utils/publicPage'

const route = useRoute()
const router = useRouter()
const siteId = computed(() => route.params.siteId as string)
const siteName = ref('')
const siteSlug = ref('')
const siteBaseUrl = ref('')
const list = ref<PageMeta[]>([])
const loading = ref(false)

async function fetchSite() {
  if (!siteId.value) return
  try {
    const { data } = await getSite(siteId.value)
    siteName.value = data.name
    siteSlug.value = data.slug ?? ''
    siteBaseUrl.value = data.baseUrl ?? ''
  } catch {
    siteName.value = ''
    siteSlug.value = ''
    siteBaseUrl.value = ''
  }
}

async function fetchList() {
  if (!siteId.value) return
  loading.value = true
  try {
    const { data } = await getPages(siteId.value)
    list.value = Array.isArray(data) ? data : []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function goNew() {
  router.push(`/sites/${siteId.value}/pages/new`)
}

function goEdit(row: PageMeta) {
  router.push(`/sites/${siteId.value}/pages/${row.id}`)
}

function openPublishedPreview(row: PageMeta) {
  const url = buildPublishedPagePreviewUrl({
    slug: siteSlug.value,
    baseUrl: siteBaseUrl.value,
    path: row.path,
  })

  if (!url) {
    ElMessage.warning('当前站点未配置 slug 或 baseUrl，无法预览')
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

async function handleDelete(row: PageMeta) {
  await ElMessageBox.confirm(`确定删除页面「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await deletePage(siteId.value, row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  }
}

onMounted(() => {
  fetchSite()
  fetchList()
})
</script>

<template>
  <div class="page-list">
    <div class="page-list__toolbar">
      <span v-if="siteName" class="page-list__site">站点：{{ siteName }}</span>
      <ElButton type="primary" @click="goNew">新建页面</ElButton>
    </div>
    <ElTable :data="list" v-loading="loading" stripe>
      <ElTableColumn prop="name" label="页面名称" min-width="160" />
      <ElTableColumn prop="path" label="路径" min-width="120" />
      <ElTableColumn prop="status" label="状态" width="100">
        <template #default="{ row }">
          <ElTag size="small">{{ row.status ?? 'draft' }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="updatedAt" label="更新时间" width="180" />
      <ElTableColumn label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="goEdit(row)">编辑</ElButton>
          <ElButton
            v-if="row.status === 'published'"
            link
            type="success"
            @click="openPublishedPreview(row)"
          >
            预览
          </ElButton>
          <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>

<style lang="scss" scoped>
.page-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-list__site {
  font-size: 14px;
  color: #606266;
}
</style>
