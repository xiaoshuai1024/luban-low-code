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
import { getSite } from '@/api/site'
import { buildPublishedPagePreviewUrl } from '@/utils/publicPage'
import TemplatePicker from './components/TemplatePicker.vue'
import type { PageTemplate } from '@/config/templates'
import { isFeatureEnabled } from '@/config/features'

const route = useRoute()
const router = useRouter()
const siteId = computed(() => route.params.siteId as string)
const siteName = ref('')
const siteSlug = ref('')
const siteBaseUrl = ref('')
const list = ref<PageMeta[]>([])
const loading = ref(false)

/** V2-T3 模板选择器（FeatureGate 控制；关闭时直接进空白新建） */
const templatesEnabled = isFeatureEnabled('templates')
const templatePickerVisible = ref(false)

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
  // V2-T3：开启模板入口时弹模板选择器；关闭时直接进空白新建
  if (templatesEnabled) {
    templatePickerVisible.value = true
  } else {
    router.push(`/designer/sites/${siteId.value}/pages/new`)
  }
}

/** V2-T3 模板选择后，带 templateId 进入编辑器（深拷贝 schema 避免 mutate 模板源） */
function onPickTemplate(tpl: PageTemplate): void {
  const schemaCopy = JSON.parse(JSON.stringify(tpl.schema)) as typeof tpl.schema
  // 通过 router state 传递模板 schema（PageEditor isNew 模式读取）
  router.push({
    path: `/designer/sites/${siteId.value}/pages/new`,
    state: { templateSchema: JSON.stringify(schemaCopy), templateName: tpl.name },
  })
}

function goEdit(row: PageMeta) {
  router.push(`/designer/sites/${siteId.value}/pages/${row.id}`)
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
    <!-- V2-T3 模板选择器 -->
    <TemplatePicker v-model="templatePickerVisible" @select="onPickTemplate" />
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
