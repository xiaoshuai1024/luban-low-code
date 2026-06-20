<script setup lang="ts">
/**
 * PageEditor.vue — 页面编辑器（T4 收口版）。
 *
 * 三栏布局：
 *   左 物料区（getPaletteGroups 渲染可拖拽卡片，dragstart 写 dataTransfer）
 *   中 画布（isDesign=true → LubanDesigner[design-mode]；false → LubanPage 只读预览）
 *   右 组件树 + 属性面板
 *
 * 与 luban-low-code 的契约（静态 import，不再动态 import + shallowRef）：
 *   - LubanDesigner.props: schema / designMode / showToolbar / placeholder
 *   - LubanDesigner.emits: update:schema / select(id|null) / add-node(type, parentId?)
 *       / reorder(fromIdx, toIdx)（root 级 Sortable onEnd）
 *   - LubanPage.props: schema
 *   - getComponentMeta(type) → ComponentMeta | undefined（含 label / defaultProps / propSchema）
 *   - getPaletteGroups() → PaletteGroup[]
 *   - reorderRootChildren(schema, fromIdx, toIdx)（root 级重排，原地变更）
 *   - canAcceptChild(type) / isContainerType(type)（容器判定）
 *
 * 选中/增删改/移动全部走 schemaTree（engine 本地纯逻辑），保证 LubanDesigner
 * emit 后真实写入 schema.root；属性面板与组件树共享 selectedId。
 *
 * 发布：复用 savePage（PUT /sites/:siteId/pages/:pageId），带 status='published'
 * （publishPage helper）。不引入独立 publish 端点，保持 Java/Go 双后端契约一致。
 *
 * 错误态：loadPage 失败不再静默回退空 schema；显示错误卡片 + 重试按钮。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElInput,
  ElFormItem,
  ElForm,
  ElMessage,
  ElCard,
  ElContainer,
  ElAside,
  ElMain,
  ElTag,
  ElMessageBox,
} from 'element-plus'
import { getPage, savePage, createPage, publishPage } from '@/api/page'
import { getDatasources, queryDatasource } from '@/api/datasource'
import type { PageSchema, NodeSchema } from '@/types/schema'
import {
  LubanDesigner,
  LubanPage,
  getComponentMeta,
  getPaletteGroups,
} from 'luban-low-code'
import PropertyPanel from './components/PropertyPanel.vue'
import ComponentTree from './components/ComponentTree.vue'
import { findNode } from './components/schemaTree'
import { useHistory } from '@/composables/useHistory'
import { useKeyboard } from '@/composables/useKeyboard'
import { useFeatureGate } from '@/composables/useFeatureGate'
import { usePageEditorApi } from '@/composables/usePageEditorApi'
import AiAssistantPanel from './components/AiAssistantPanel.vue'

const route = useRoute()
const router = useRouter()
const siteId = computed(() => route.params.siteId as string)
const pageId = computed(() => route.params.pageId as string)
const isNew = computed(() => route.name === 'PageNew' || Boolean(route.meta.isNew))

const pageName = ref('')
const pagePath = ref('')
const pageStatus = ref<string>('draft')
const schema = ref<PageSchema | null>(null)
/** 当前 site 的数据源列表（PropertyPanel 数据源区消费）。 */
const datasources = ref<Array<{ id: string; name: string }>>([])
/** 预览时数据源拉取器（传给 LubanPage 注入表达式上下文）；透传 node.datasource.params。 */
const datasourceFetcher = (id: string, params?: Record<string, unknown>) =>
  queryDatasource(id, params).then((r) => r.data)
const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const loadError = ref<string | null>(null)

/** 选中节点 id（画布选中、组件树选中、属性面板共同消费）。null 表示未选。 */
const selectedId = ref<string | null>(null)
/** 设计/预览模式切换：true=设计画布，false=只读渲染预览。 */
const isDesign = ref(true)

/** 撤销/重做历史栈（结构变更与属性变更均入栈；属性输入噪声由 limit 截断兜底）。 */
const history = useHistory(schema)
const { canUndo, canRedo } = history
const { isEnabled } = useFeatureGate()
const featureUndo = isEnabled('editor.undo')
const featureShortcuts = isEnabled('editor.shortcuts')

/**
 * 画布操作收口（plan P1-T8）：所有 schema mutation 经 api，撤销栈语义统一。
 * AI 面板（AiAssistantPanel）与用户操作共享同一 schema + 撤销栈 ——
 * AI 改动可被 Ctrl+Z 撤销（plan §3 验收口径）。
 */
const api = usePageEditorApi({ schema, history, selectedId })

/** AI 助手面板开关（FeatureGate ai.assistant 关则隐藏入口，编辑器回归原状）。 */
const featureAiAssistant = isEnabled('ai.assistant')
const aiPanelOpen = ref(false)

if (featureShortcuts) {
  useKeyboard({
    undo: () => history.undo(),
    redo: () => history.redo(),
    save: () => handleSave(),
    delete: () => { if (selectedId.value) api.deleteNode(selectedId.value) },
    duplicate: () => { if (selectedId.value) api.duplicateNode(selectedId.value) },
  })
}

/** 物料面板分组（一次性派生；物料注册在 luban-low-code side-effect import 完成）。 */
const paletteGroups = computed(() => getPaletteGroups())

const selectedNode = computed<NodeSchema | null>(() => {
  if (!schema.value?.root || !selectedId.value) return null
  return findNode(schema.value.root, selectedId.value)
})

const selectedMeta = computed(() => {
  if (!selectedNode.value) return null
  return getComponentMeta(selectedNode.value.type) ?? null
})

/** 当前页面发布状态徽标颜色。 */
function statusTagType(status: string): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'published') return 'success'
  if (status === 'draft') return 'info'
  return 'warning'
}

/** 给 ComponentTree 注入的 label 解析：优先用 meta.label，回退 type。 */
function getLabel(node: NodeSchema): string {
  return getComponentMeta(node.type)?.label ?? node.type
}

async function loadPage() {
  if (!siteId.value || (isNew.value ? false : !pageId.value)) return
  loading.value = true
  loadError.value = null
  try {
    if (isNew.value) {
      pageName.value = ''
      pagePath.value = ''
      pageStatus.value = 'draft'
      schema.value = {
        root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
      }
    } else {
      const { data } = await getPage(siteId.value, pageId.value)
      pageName.value = data.name
      pagePath.value = data.path
      pageStatus.value = data.status ?? 'draft'
      schema.value = data.schema ?? {
        root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
      }
    }
    // R4a: clear the undo/redo stack on page switch so Ctrl+Z can't cross into
    // the previous page's schema (data-safety: history is per-page, not global).
    history.reset()
  } catch (e) {
    // 不再静默回退；记录错误供 UI 显示重试卡片。
    loadError.value = (e as Error)?.message || '加载页面失败'
    schema.value = null
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!schema.value || !siteId.value) return
  if (!pageName.value || !pagePath.value) {
    ElMessage.warning('请填写页面名称和路径')
    return
  }
  saving.value = true
  try {
    if (isNew.value) {
      const { data } = await createPage(siteId.value, {
        name: pageName.value,
        path: pagePath.value,
        schema: schema.value,
      })
      ElMessage.success('创建成功')
      router.replace(`/sites/${siteId.value}/pages/${data.id}`)
    } else {
      await savePage(siteId.value, pageId.value, {
        name: pageName.value,
        path: pagePath.value,
        schema: schema.value,
      })
      ElMessage.success('保存成功')
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handlePublish() {
  if (!schema.value || !siteId.value || !pageId.value || isNew.value) {
    ElMessage.warning('请先保存页面再发布')
    return
  }
  if (!pageName.value || !pagePath.value) {
    ElMessage.warning('请填写页面名称和路径')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认发布页面「${pageName.value}」？发布后访问者将看到最新内容。`,
      '发布确认',
      { type: 'warning', confirmButtonText: '发布', cancelButtonText: '取消' }
    )
  } catch {
    // 用户取消
    return
  }
  publishing.value = true
  try {
    const { data } = await publishPage(siteId.value, pageId.value, {
      name: pageName.value,
      path: pagePath.value,
      schema: schema.value,
    })
    pageStatus.value = data?.status ?? 'published'
    ElMessage.success('发布成功')
  } catch (e) {
    ElMessage.error((e as Error).message || '发布失败')
  } finally {
    publishing.value = false
  }
}

function goBack() {
  router.push(`/sites/${siteId.value}/pages`)
}

// === LubanDesigner / 组件树事件 ===
// 所有 schema mutation 已收口到 usePageEditorApi（api.*）。
// 模板事件绑定直接委托 api.select/addNode/reorder/moveNode/updateProp/updateEvent/
// updateDatasource/deleteNode/duplicateNode/move（见 template）。

// === 物料拖拽（左侧 → 画布） ===

function onPaletteDragStart(e: DragEvent, type: string): void {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('application/json', JSON.stringify({ type }))
}

async function loadDatasources() {
  if (!siteId.value) return
  try {
    const { data } = await getDatasources(siteId.value)
    datasources.value = (data ?? []).map((d) => ({ id: d.id, name: d.name }))
  } catch {
    datasources.value = []
  }
}

onMounted(() => {
  loadPage()
  loadDatasources()
})
watch([siteId, pageId], loadPage)
watch(siteId, loadDatasources)
</script>

<template>
  <div class="page-editor" v-loading="loading">
    <!-- 顶部 meta + 操作 -->
    <ElCard class="page-editor__meta" shadow="never">
      <ElForm inline>
        <ElFormItem label="页面名称">
          <ElInput v-model="pageName" placeholder="名称" style="width: 200px" />
        </ElFormItem>
        <ElFormItem label="路径">
          <ElInput v-model="pagePath" placeholder="/page-path" style="width: 200px" />
        </ElFormItem>
        <ElFormItem>
          <ElTag :type="statusTagType(pageStatus)" size="small">
            {{ pageStatus === 'published' ? '已发布' : '草稿' }}
          </ElTag>
        </ElFormItem>
        <ElFormItem v-if="featureUndo">
          <ElButton
            :disabled="!canUndo"
            title="撤销 (Ctrl+Z)"
            @click="history.undo()"
          >
            ↶ 撤销
          </ElButton>
          <ElButton
            :disabled="!canRedo"
            title="重做 (Ctrl+Shift+Z / Ctrl+Y)"
            @click="history.redo()"
          >
            ↷ 重做
          </ElButton>
          <ElButton
            :type="isDesign ? 'default' : 'primary'"
            @click="isDesign = !isDesign"
          >
            {{ isDesign ? '预览' : '回到设计' }}
          </ElButton>
          <ElButton type="primary" :loading="saving" @click="handleSave">
            {{ isNew ? '创建' : '保存' }}
          </ElButton>
          <ElButton
            type="success"
            :loading="publishing"
            :disabled="isNew"
            @click="handlePublish"
          >
            发布
          </ElButton>
          <ElButton @click="goBack">返回列表</ElButton>
          <!-- AI 助手入口（FeatureGate ai.assistant 关则隐藏，编辑器回归原状 plan §6.5） -->
          <ElButton
            v-if="featureAiAssistant"
            type="primary"
            plain
            title="AI 助手：自然语言生成/编辑页面"
            @click="aiPanelOpen = true"
          >
            ✨ AI 助手
          </ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <!-- 错误态：加载失败不再静默 -->
    <ElCard v-if="loadError" class="page-editor__error-card" shadow="never">
      <p class="page-editor__error">{{ loadError }}</p>
      <ElButton type="primary" @click="loadPage">重试</ElButton>
    </ElCard>

    <!-- 三栏工作区 -->
    <ElContainer v-else-if="schema" class="page-editor__workspace">
      <ElAside width="220px" class="page-editor__aside page-editor__palette">
        <div class="page-editor__panel-title">物料</div>
        <div
          v-for="group in paletteGroups"
          :key="group.category"
          class="page-editor__palette-group"
        >
          <div class="page-editor__palette-cat">{{ group.category }}</div>
          <div
            v-for="item in group.items"
            :key="item.type"
            class="page-editor__palette-item"
            draggable="true"
            @dragstart="(e) => onPaletteDragStart(e, item.type)"
          >
            {{ item.label }}
          </div>
        </div>
      </ElAside>

      <ElMain class="page-editor__main">
        <LubanDesigner
          v-if="isDesign"
          v-model:schema="schema"
          :design-mode="true"
          :show-toolbar="false"
          placeholder="从左侧拖拽组件到此处"
          @select="api.select"
          @add-node="api.addNode"
          @reorder="api.reorder"
          @move-node="api.moveNode"
        />
        <LubanPage v-else :schema="schema" :datasource-fetcher="datasourceFetcher" />
      </ElMain>

      <ElAside width="300px" class="page-editor__aside page-editor__right">
        <ComponentTree
          :schema="schema"
          :selected-id="selectedId"
          :get-label="getLabel"
          @select="api.select"
          @delete="api.deleteNode"
          @move="api.move"
        />
        <div class="page-editor__right-divider" />
        <PropertyPanel
          :node="selectedNode"
          :meta="selectedMeta"
          :datasources="datasources"
          @update:prop="api.updateProp"
          @update:event="api.updateEvent"
          @update:datasource="api.updateDatasource"
          @delete="api.deleteNode"
          @duplicate="api.duplicateNode"
        />
      </ElAside>
    </ElContainer>

    <!-- AI 助手右侧抽屉浮层（零侵入：不破坏三栏 flex，叠加在右侧 ElAside 之上 plan §4.3）。
         AI 改动经 api（usePageEditorApi）落地，自动入撤销栈，可 Ctrl+Z 撤销。 -->
    <AiAssistantPanel
      v-if="featureAiAssistant"
      v-model="aiPanelOpen"
      :site-id="siteId"
      :page-id="pageId"
      :schema="schema"
      :api="api"
      :selected-id="selectedId"
    />
  </div>
</template>

<style lang="scss" scoped>
.page-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  &__meta {
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  &__error-card {
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  &__workspace {
    flex: 1;
    min-height: 0;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    background: #fff;
  }

  &__aside {
    background: #fafafa;
    overflow: auto;
    box-sizing: border-box;
  }

  &__palette {
    border-right: 1px solid #ebeef5;
  }

  &__right {
    border-left: 1px solid #ebeef5;
    display: flex;
    flex-direction: column;
  }

  &__right-divider {
    height: 1px;
    background: #ebeef5;
    flex-shrink: 0;
  }

  &__main {
    background: #fff;
    padding: 12px;
    overflow: auto;
  }

  &__panel-title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
    padding: 12px 12px 8px;
    border-bottom: 1px solid #ebeef5;
  }

  &__palette-group {
    padding: 8px 12px;
  }

  &__palette-cat {
    font-size: 12px;
    color: #909399;
    margin-bottom: 6px;
  }

  &__palette-item {
    user-select: none;
    cursor: grab;
    padding: 6px 10px;
    margin-bottom: 4px;
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 13px;
    color: #303133;

    &:hover {
      border-color: #409eff;
      color: #409eff;
    }

    &:active {
      cursor: grabbing;
    }
  }

  &__error {
    color: #f56c6c;
    margin: 0 0 8px;
  }
}
</style>
