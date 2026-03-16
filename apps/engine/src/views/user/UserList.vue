<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  ElButton,
  ElTable,
  ElTableColumn,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElMessage,
  ElMessageBox,
  ElTag,
  ElPagination,
} from 'element-plus'
import { getUsers, createUser, updateUser, setUserStatus, type User, type UserCreatePayload } from '@/api/user'

const list = ref<User[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = ref<UserCreatePayload & { id?: string }>({
  username: '',
  password: '',
  name: '',
  role: 'user',
})
const formLoading = ref(false)

async function fetchList() {
  loading.value = true
  try {
    const { data } = await getUsers({
      page: page.value,
      size: pageSize.value,
      keyword: keyword.value || undefined,
    })
    list.value = data?.list ?? []
    total.value = data?.total ?? 0
  } catch {
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = { username: '', password: '', name: '', role: 'user' }
  dialogVisible.value = true
}

function openEdit(row: User) {
  editingId.value = row.id
  form.value = {
    username: row.username,
    name: row.name ?? '',
    role: (row.role as string) ?? 'user',
  }
  dialogVisible.value = true
}

async function submitForm() {
  if (!form.value.username) {
    ElMessage.warning('请输入账号')
    return
  }
  if (!editingId.value && !form.value.password) {
    ElMessage.warning('请输入密码')
    return
  }
  formLoading.value = true
  try {
    if (editingId.value) {
      await updateUser(editingId.value, {
        username: form.value.username,
        name: form.value.name,
        role: form.value.role,
      })
      ElMessage.success('更新成功')
    } else {
      await createUser({
        username: form.value.username,
        password: form.value.password!,
        name: form.value.name,
        role: form.value.role,
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败')
  } finally {
    formLoading.value = false
  }
}

async function handleStatus(row: User) {
  const next = row.status === 'active' ? 'disabled' : 'active'
  await ElMessageBox.confirm(
    `确定${next === 'active' ? '启用' : '禁用'}用户「${row.username}」？`,
    '提示',
    { type: 'warning' }
  )
  try {
    await setUserStatus(row.id, next)
    ElMessage.success('操作成功')
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败')
  }
}

function onPageChange(p: number) {
  page.value = p
  fetchList()
}

function onSizeChange(s: number) {
  pageSize.value = s
  page.value = 1
  fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="user-list">
    <div class="user-list__toolbar">
      <ElInput
        v-model="keyword"
        placeholder="搜索账号/姓名"
        clearable
        style="width: 200px"
        @keyup.enter="fetchList"
      />
      <ElButton type="primary" @click="fetchList">查询</ElButton>
      <ElButton type="primary" @click="openCreate">新建用户</ElButton>
    </div>
    <ElTable :data="list" v-loading="loading" stripe>
      <ElTableColumn prop="username" label="账号" min-width="120" />
      <ElTableColumn prop="name" label="姓名" min-width="100" />
      <ElTableColumn prop="role" label="角色" width="100" />
      <ElTableColumn prop="status" label="状态" width="80">
        <template #default="{ row }">
          <ElTag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.status === 'active' ? '正常' : '禁用' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="createdAt" label="创建时间" width="180" />
      <ElTableColumn label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
          <ElButton
            link
            :type="row.status === 'active' ? 'warning' : 'primary'"
            @click="handleStatus(row)"
          >
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
    <ElPagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="user-list__pagination"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />

    <ElDialog v-model="dialogVisible" :title="editingId ? '编辑用户' : '新建用户'" width="500px">
      <ElForm :model="form" label-width="80px">
        <ElFormItem label="账号">
          <ElInput v-model="form.username" placeholder="账号" :disabled="!!editingId" />
        </ElFormItem>
        <ElFormItem v-if="!editingId" label="密码">
          <ElInput v-model="form.password" type="password" placeholder="密码" show-password />
        </ElFormItem>
        <ElFormItem label="姓名">
          <ElInput v-model="form.name" placeholder="姓名" />
        </ElFormItem>
        <ElFormItem label="角色">
          <ElSelect v-model="form.role" placeholder="角色" style="width: 100%">
            <ElOption label="用户" value="user" />
            <ElOption label="管理员" value="admin" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="formLoading" @click="submitForm">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style lang="scss" scoped>
.user-list__toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.user-list__pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
