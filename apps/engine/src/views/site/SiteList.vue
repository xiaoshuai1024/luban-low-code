<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElButton,
  ElTable,
  ElTableColumn,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
} from 'element-plus'
import { getSites, createSite, updateSite, deleteSite, type Site } from '@/api/site'

const router = useRouter()
const list = ref<Site[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = ref<Partial<Site>>({ name: '', slug: '', baseUrl: '', status: 'active' })

async function fetchList() {
  loading.value = true
  try {
    const { data } = await getSites()
    list.value = Array.isArray(data) ? data : []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', slug: '', baseUrl: '', status: 'active' }
  dialogVisible.value = true
}

function openEdit(row: Site) {
  editingId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

async function submitForm() {
  if (!form.value.name) {
    ElMessage.warning('请输入站点名称')
    return
  }
  try {
    if (editingId.value) {
      await updateSite(editingId.value, form.value as Partial<Site>)
      ElMessage.success('更新成功')
    } else {
      await createSite(form.value as Omit<Site, 'id' | 'createdAt' | 'updatedAt'>)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败')
  }
}

function goDetail(row: Site) {
  router.push(`/sites/${row.id}`)
}

function goPages(row: Site) {
  router.push(`/sites/${row.id}/pages`)
}

async function handleDelete(row: Site) {
  await ElMessageBox.confirm(`确定删除站点「${row.name}」？`, '提示', {
    type: 'warning',
  })
  try {
    await deleteSite(row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="site-list">
    <div class="site-list__toolbar">
      <ElButton type="primary" @click="openCreate">新建站点</ElButton>
    </div>
    <ElTable :data="list" v-loading="loading" stripe>
      <ElTableColumn prop="name" label="名称" min-width="120" />
      <ElTableColumn prop="slug" label="标识" width="120" />
      <ElTableColumn prop="baseUrl" label="基础 URL" min-width="160" />
      <ElTableColumn prop="status" label="状态" width="80" />
      <ElTableColumn label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="goDetail(row)">详情</ElButton>
          <ElButton link type="primary" @click="goPages(row)">页面</ElButton>
          <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
          <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog v-model="dialogVisible" :title="editingId ? '编辑站点' : '新建站点'" width="500px">
      <ElForm :model="form" label-width="80px">
        <ElFormItem label="名称">
          <ElInput v-model="form.name" placeholder="站点名称" />
        </ElFormItem>
        <ElFormItem label="标识">
          <ElInput v-model="form.slug" placeholder="slug" />
        </ElFormItem>
        <ElFormItem label="基础 URL">
          <ElInput v-model="form.baseUrl" placeholder="https://..." />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElInput v-model="form.status" placeholder="active / inactive" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitForm">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style lang="scss" scoped>
.site-list__toolbar {
  margin-bottom: 16px;
}
</style>
