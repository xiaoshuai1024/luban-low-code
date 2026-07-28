<script setup lang="ts">
/**
 * DatasourceManageDialog — 数据源管理弹窗（D15-B1，R2）。
 *
 * 列表展示当前 site 的数据源，支持新建/编辑/删除（调 datasource.ts CRUD），
 * 配「测试连通」按钮（调 testDatasource 显示 ok/message/latencyMs）。
 * CRUD 完成后 emit('refresh') 通知 PageEditor 重新 loadDatasources 刷新下拉。
 *
 * 依赖 Element Plus（ElDialog/ElTable/ElButton/ElForm/ElInput/ElSelect/ElMessage）。
 */
import { ref, watch } from 'vue'
import {
  ElDialog,
  ElTable,
  ElTableColumn,
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElMessage,
  ElMessageBox,
  ElTag,
} from 'element-plus'
import {
  getDatasources,
  createDatasource,
  updateDatasource,
  deleteDatasource,
  testDatasource,
} from '@/api/datasource'
import type {
  DatasourceMeta,
  SaveDatasourcePayload,
  DatasourceTestResult,
} from '@/api/datasource'
import { isFeatureEnabled } from '@/config/features'

interface Props {
  /** v-model:visible */
  modelValue: boolean
  siteId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  /** CRUD 完成后通知父组件刷新数据源下拉 */
  (e: 'refresh'): void
}>()

/** 测试连通按钮开关（FeatureGate） */
const testConnectEnabled = isFeatureEnabled('testConnect')

/** 列表数据 + 加载态 */
const list = ref<DatasourceMeta[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

/** 编辑/新建态 */
const editing = ref(false)
const editForm = ref<SaveDatasourcePayload & { id?: string }>(emptyForm())
const saving = ref(false)

/** 测试连通结果（按 id 缓存最近一次结果） */
const testResults = ref<Record<string, DatasourceTestResult>>({})
const testingIds = ref<Set<string>>(new Set())

function emptyForm(): SaveDatasourcePayload & { id?: string } {
  return { id: undefined, siteId: props.siteId, name: '', type: 'static', config: {} }
}

async function loadList() {
  if (!props.siteId) return
  loading.value = true
  loadError.value = null
  try {
    const { data } = await getDatasources(props.siteId)
    list.value = data ?? []
  } catch (e) {
    loadError.value = (e as Error)?.message || '加载数据源失败'
    list.value = []
  } finally {
    loading.value = false
  }
}

/** 弹窗打开时加载列表 */
watch(
  () => props.modelValue,
  (v) => {
    if (v) loadList()
  }
)

function handleClose() {
  emit('update:modelValue', false)
}

function handleCreate() {
  editForm.value = emptyForm()
  editing.value = true
}

function handleEdit(row: DatasourceMeta) {
  editForm.value = {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    type: row.type,
    config: row.config ?? {},
  }
  editing.value = true
}

function handleCancelEdit() {
  editing.value = false
  editForm.value = emptyForm()
}

async function handleSave() {
  if (!editForm.value.name) {
    ElMessage.warning('请填写数据源名称')
    return
  }
  saving.value = true
  try {
    const payload: SaveDatasourcePayload = {
      siteId: editForm.value.siteId,
      name: editForm.value.name,
      type: editForm.value.type,
      config: editForm.value.config,
    }
    if (editForm.value.id) {
      await updateDatasource(editForm.value.id, payload)
      ElMessage.success('更新成功')
    } else {
      await createDatasource(payload)
      ElMessage.success('创建成功')
    }
    editing.value = false
    await loadList()
    emit('refresh')
  } catch (e) {
    ElMessage.error((e as Error)?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: DatasourceMeta) {
  try {
    await ElMessageBox.confirm(`确认删除数据源「${row.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await deleteDatasource(row.id)
    ElMessage.success('删除成功')
    await loadList()
    emit('refresh')
  } catch (e) {
    ElMessage.error((e as Error)?.message || '删除失败')
  }
}

async function handleTest(row: DatasourceMeta) {
  testingIds.value.add(row.id)
  try {
    const { data } = await testDatasource(row.id)
    testResults.value[row.id] = data
    if (data.ok) {
      ElMessage.success(`连通成功（${data.latencyMs ?? 0}ms）`)
    } else {
      ElMessage.warning(`连通失败：${data.message ?? '未知原因'}`)
    }
  } catch (e) {
    testResults.value[row.id] = { ok: false, message: (e as Error)?.message }
    ElMessage.error('测试连通失败')
  } finally {
    testingIds.value.delete(row.id)
  }
}

/** static 类型配置：rows（JSON 文本编辑）；api 类型：url/method/headers */
function configText(): string {
  const cfg = editForm.value.config ?? {}
  try {
    return JSON.stringify(cfg, null, 2)
  } catch {
    return ''
  }
}

function handleConfigInput(text: string) {
  let parsed: unknown = text
  if (text.trim() !== '') {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text // 保留非法 JSON 文本，保存时由用户修正
    }
  }
  editForm.value.config = parsed as Record<string, unknown>
}
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    title="管理数据源"
    width="680px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <!-- 列表态 -->
    <div v-if="!editing" v-loading="loading">
      <div v-if="loadError" class="ds-dialog__error">
        <p>{{ loadError }}</p>
        <ElButton size="small" @click="loadList">重试</ElButton>
      </div>
      <div class="ds-dialog__toolbar">
        <ElButton type="primary" size="small" @click="handleCreate">+ 新建数据源</ElButton>
      </div>
      <ElTable :data="list" size="small" empty-text="暂无数据源">
        <ElTableColumn prop="name" label="名称" />
        <ElTableColumn prop="type" label="类型" width="100">
          <template #default="{ row }">
            <ElTag size="small" :type="row.type === 'api' ? 'warning' : 'info'">{{ row.type }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn v-if="testConnectEnabled" label="连通" width="180">
          <template #default="{ row }">
            <ElButton
              link
              size="small"
              :loading="testingIds.has(row.id)"
              @click="handleTest(row)"
            >
              测试连通
            </ElButton>
            <span
              v-if="testResults[row.id]"
              class="ds-dialog__test-result"
              :class="{ 'is-ok': testResults[row.id].ok, 'is-fail': !testResults[row.id].ok }"
            >
              {{ testResults[row.id].ok ? `✓ ${testResults[row.id].latencyMs ?? 0}ms` : '✗ 失败' }}
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="140">
          <template #default="{ row }">
            <ElButton link size="small" @click="handleEdit(row)">编辑</ElButton>
            <ElButton link type="danger" size="small" @click="handleDelete(row)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <!-- 编辑/新建态 -->
    <ElForm v-else label-position="top" size="small">
      <ElFormItem label="名称">
        <ElInput v-model="editForm.name" placeholder="数据源名称" />
      </ElFormItem>
      <ElFormItem label="类型">
        <ElSelect v-model="editForm.type" style="width: 100%">
          <ElOption label="静态（static）" value="static" />
          <ElOption label="接口（api）" value="api" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="配置（JSON）">
        <ElInput
          :model-value="configText()"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 12 }"
          :placeholder="editForm.type === 'api' ? '{&quot;url&quot;:&quot;https://...&quot;,&quot;method&quot;:&quot;GET&quot;}' : '{&quot;rows&quot;:[...]}'"
          @update:model-value="(v: string) => handleConfigInput(v)"
        />
      </ElFormItem>
      <div class="ds-dialog__edit-actions">
        <ElButton size="small" @click="handleCancelEdit">取消</ElButton>
        <ElButton size="small" type="primary" :loading="saving" @click="handleSave">
          {{ editForm.id ? '保存' : '创建' }}
        </ElButton>
      </div>
    </ElForm>

    <template #footer>
      <ElButton @click="handleClose">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<style lang="scss" scoped>
.ds-dialog__toolbar {
  margin-bottom: 12px;
}
.ds-dialog__error {
  color: #f56c6c;
  margin-bottom: 12px;
}
.ds-dialog__test-result {
  margin-left: 8px;
  font-size: 12px;
  &.is-ok { color: #67c23a; }
  &.is-fail { color: #f56c6c; }
}
.ds-dialog__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
