<script setup lang="ts">
/**
 * CollectionList.vue — V2-T7 CMS 内容集合管理。
 *
 * 列出当前站点的 collection，支持新建/编辑/删除 collection + 管理 collection items。
 * fieldSchema 用 JSON 编辑器（字段定义）；items 以表格展示 + 行内 JSON 编辑。
 *
 * FeatureGate：VITE_FEATURE_CMS。
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  ElButton,
  ElTable,
  ElTableColumn,
  ElMessage,
  ElMessageBox,
  ElTag,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElEmpty,
} from 'element-plus'
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionItems,
  createCollectionItem,
  deleteCollectionItem,
  type CollectionResponse,
  type CollectionItemResponse,
} from '@/api/collection'

const route = useRoute()
const siteId = computed(() => route.params.siteId as string)
const collections = ref<CollectionResponse[]>([])
const loading = ref(false)

/** 当前选中 collection 的 items（展开行时加载） */
const expandedItems = ref<Record<string, CollectionItemResponse[]>>({})

/** 新建/编辑弹窗 */
const dialogVisible = ref(false)
const editing = ref<CollectionResponse | null>(null)
const form = ref({ name: '', fieldSchemaText: '{"fields":[]}', status: 'active' })

async function fetchList() {
  if (!siteId.value) return
  loading.value = true
  try {
    const { data } = await getCollections(siteId.value)
    collections.value = Array.isArray(data) ? data : []
  } catch (e) {
    collections.value = []
    ElMessage.error((e as Error)?.message || '加载集合失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', fieldSchemaText: '{"fields":[]}', status: 'active' }
  dialogVisible.value = true
}

function openEdit(row: CollectionResponse) {
  editing.value = row
  form.value = {
    name: row.name,
    fieldSchemaText: JSON.stringify(row.fieldSchema ?? { fields: [] }, null, 2),
    status: row.status ?? 'active',
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.name) {
    ElMessage.warning('请填写集合名称')
    return
  }
  let fieldSchema: Record<string, unknown>
  try {
    fieldSchema = JSON.parse(form.value.fieldSchemaText)
  } catch {
    ElMessage.error('字段定义 JSON 格式错误')
    return
  }
  try {
    if (editing.value) {
      await updateCollection(siteId.value, editing.value.id, {
        name: form.value.name,
        fieldSchema,
        status: form.value.status,
      })
      ElMessage.success('保存成功')
    } else {
      await createCollection(siteId.value, {
        name: form.value.name,
        fieldSchema,
        status: form.value.status,
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  }
}

async function handleDelete(row: CollectionResponse) {
  try {
    await ElMessageBox.confirm(
      `确定删除集合「${row.name}」？集合下所有内容项将一并删除。`,
      '提示',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await deleteCollection(siteId.value, row.id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  }
}

/** 展开行：加载 items */
async function onExpand(row: CollectionResponse, expanded: boolean) {
  if (!expanded) return
  try {
    const { data } = await getCollectionItems(siteId.value, row.id)
    expandedItems.value[row.id] = Array.isArray(data) ? data : []
  } catch {
    expandedItems.value[row.id] = []
  }
}

/** 新增内容项 */
async function addNewItem(collectionId: string) {
  try {
    await createCollectionItem(siteId.value, collectionId, { data: { title: '新内容项' } })
    const { data } = await getCollectionItems(siteId.value, collectionId)
    expandedItems.value[collectionId] = Array.isArray(data) ? data : []
    ElMessage.success('已新增内容项')
  } catch (e) {
    ElMessage.error((e as Error).message || '新增失败')
  }
}

async function deleteItem(collectionId: string, itemId: string) {
  try {
    await deleteCollectionItem(siteId.value, collectionId, itemId)
    const { data } = await getCollectionItems(siteId.value, collectionId)
    expandedItems.value[collectionId] = Array.isArray(data) ? data : []
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  }
}

/** items 表格：data 字段摘要展示 */
function itemSummary(item: CollectionItemResponse): string {
  const d = item.data
  if (!d) return ''
  const vals = Object.values(d).filter((v) => v != null && v !== '')
  return vals.slice(0, 3).map(String).join(' | ')
}

onMounted(() => {
  fetchList()
})
</script>

<template>
  <div class="collection-list">
    <div class="collection-list__toolbar">
      <span class="collection-list__title">CMS 内容集合</span>
      <ElButton type="primary" :disabled="!siteId" @click="openCreate">新建集合</ElButton>
    </div>
    <ElEmpty v-if="!loading && collections.length === 0" description="暂无集合，点击「新建集合」创建">
      <ElButton type="primary" @click="openCreate">新建集合</ElButton>
    </ElEmpty>
    <ElTable
      v-else
      :data="collections"
      v-loading="loading"
      stripe
      row-key="id"
      @expand-change="(row: CollectionResponse, expanded: CollectionResponse[]) => onExpand(row, expanded.includes(row))"
    >
      <ElTableColumn type="expand">
        <template #default="{ row }">
          <div class="collection-list__items">
            <div class="collection-list__items-head">
              <span>内容项（{{ (expandedItems[row.id] ?? []).length }}）</span>
              <ElButton size="small" type="primary" link @click="addNewItem(row.id)">+ 新增内容项</ElButton>
            </div>
            <ElTable :data="expandedItems[row.id] ?? []" size="small" border>
              <ElTableColumn label="内容摘要" min-width="200">
                <template #default="{ row: item }">{{ itemSummary(item) }}</template>
              </ElTableColumn>
              <ElTableColumn prop="status" label="状态" width="80" />
              <ElTableColumn prop="updatedAt" label="更新时间" width="160" />
              <ElTableColumn label="操作" width="80">
                <template #default="{ row: item }">
                  <ElButton link size="small" type="danger" @click="deleteItem(row.id, item.id)">删除</ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="name" label="集合名称" min-width="160" />
      <ElTableColumn prop="status" label="状态" width="100">
        <template #default="{ row }">
          <ElTag size="small" :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '启用' : row.status }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="createdAt" label="创建时间" width="180" />
      <ElTableColumn label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
          <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <!-- 新建/编辑弹窗 -->
    <ElDialog v-model="dialogVisible" :title="editing ? '编辑集合' : '新建集合'" width="600px">
      <ElForm label-position="top">
        <ElFormItem label="集合名称">
          <ElInput v-model="form.name" placeholder="如：文章列表" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSelect v-model="form.status" style="width: 200px">
            <ElOption label="启用" value="active" />
            <ElOption label="停用" value="inactive" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="字段定义（JSON）">
          <ElInput
            v-model="form.fieldSchemaText"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 16 }"
            placeholder='{"fields":[{"name":"title","label":"标题","type":"string"},{"name":"body","label":"正文","type":"text"}]}'
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="handleSave">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style lang="scss" scoped>
.collection-list {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  &__items {
    padding: 12px 16px;
  }

  &__items-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    color: #606266;
  }
}
</style>
