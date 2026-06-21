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
import { getDatasources, queryDatasource, testDatasource } from '@/api/datasource'
import type { PageSchema, NodeSchema } from '@/types/schema'
import {
  LubanDesigner,
  LubanPage,
  getComponentMeta,
  getPaletteGroups,
  reorderRootChildren,
  isContainerType,
} from 'luban-low-code'
import type { ResponsiveBreakpoint } from 'luban-low-code'
import PropertyPanel from './components/PropertyPanel.vue'
import ComponentTree from './components/ComponentTree.vue'
import DatasourceManageDialog from './components/DatasourceManageDialog.vue'
import PageSeoPanel from './components/PageSeoPanel.vue'
import VersionHistory from './components/VersionHistory.vue'
import { findNode, findParent, removeNode, moveChild, moveNodeAcross } from './components/schemaTree'
import { useHistory } from '@/composables/useHistory'
import { useKeyboard } from '@/composables/useKeyboard'
import { isFeatureEnabled } from '@/config/features'
import type { PageSeo } from '@/types/schema'

/** V2-T2 SEO FeatureGate */
const seoEnabled = isFeatureEnabled('seo')
/** V2-T8 版本历史 FeatureGate */
const versionHistoryEnabled = isFeatureEnabled('versionHistory')
/** V2-T8 版本历史抽屉 */
const versionHistoryVisible = ref(false)

/** V2-T8 回滚后重新加载页面 */
function onVersionRollback(): void {
  loadPage()
}

const route = useRoute()
const router = useRouter()
const siteId = computed(() => route.params.siteId as string)
const pageId = computed(() => route.params.pageId as string)
const isNew = computed(() => route.name === 'PageNew' || Boolean(route.meta.isNew))
/** 是否在全屏设计器模式（独立路由 /designer/...，无侧边栏/顶栏） */
const isDesignerMode = computed(() => Boolean(route.meta.designer))

const pageName = ref('')
const pagePath = ref('')
const pageStatus = ref<string>('draft')
const schema = ref<PageSchema | null>(null)
/** V2-T2 页面级 SEO（独立于 schema.seo，save/publish 时同步写入两处：PageMeta.seo + schema.seo） */
const pageSeo = ref<PageSeo>({})
/** 当前 site 的数据源列表（PropertyPanel 数据源区消费）。 */
const datasources = ref<Array<{ id: string; name: string }>>([])
/** 预览时数据源拉取器（传给 LubanPage 注入表达式上下文） */
const datasourceFetcher = (id: string) => queryDatasource(id).then((r) => r.data)
const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const loadError = ref<string | null>(null)

/** 选中节点 id（画布选中、组件树选中、属性面板共同消费）。null 表示未选。 */
const selectedId = ref<string | null>(null)
/** 设计/预览模式切换：true=设计画布，false=只读渲染预览。 */
const isDesign = ref(true)

/** V2-T4 当前断点（设计态；透传给 LubanDesigner→DesignRenderer 渲染对应断点 style） */
const currentBreakpoint = ref<ResponsiveBreakpoint>('desktop')
/** V2-T4 响应式 FeatureGate */
const responsiveEnabled = isFeatureEnabled('responsive')

/** 断点对应的画布模拟宽度（设计态可视化；desktop=100%） */
const BREAKPOINT_WIDTHS: Record<ResponsiveBreakpoint, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}
const canvasWidth = computed(() =>
  responsiveEnabled ? BREAKPOINT_WIDTHS[currentBreakpoint.value] : '100%'
)

/** V2-T4 切换断点 */
function setBreakpoint(bp: ResponsiveBreakpoint): void {
  currentBreakpoint.value = bp
}

/** 撤销/重做历史栈（结构变更与属性变更均入栈；属性输入噪声由 limit 截断兜底）。 */
const history = useHistory(schema)
const { canUndo, canRedo } = history
useKeyboard({
  undo: () => history.undo(),
  redo: () => history.redo(),
  save: () => handleSave(),
  delete: () => { if (selectedId.value) onDeleteNode(selectedId.value) },
  duplicate: () => { if (selectedId.value) onDuplicateNode(selectedId.value) },
  lock: () => { if (selectedId.value) onToggleLock(selectedId.value) },
  hide: () => { if (selectedId.value) onToggleHide(selectedId.value) },
})

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

/** crypto.randomUUID 在浏览器与 jsdom 新版本可用；加兜底以防旧环境。 */
function genId(prefix = 'n'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* noop */
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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
      pageSeo.value = {}
      // V2-T3：优先从 router state 读取模板 schema（PageList 选模板后传入）
      const tplSchemaRaw = typeof window !== 'undefined' ? window.history.state?.templateSchema : undefined
      const tplName = typeof window !== 'undefined' ? window.history.state?.templateName : undefined
      if (tplSchemaRaw) {
        try {
          schema.value = JSON.parse(tplSchemaRaw) as PageSchema
        } catch {
          schema.value = {
            root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
          }
        }
      } else {
        schema.value = {
          root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
        }
      }
      // 模板名预填页面名（用户可改）
      if (tplName) pageName.value = tplName
    } else {
      const { data } = await getPage(siteId.value, pageId.value)
      pageName.value = data.name
      pagePath.value = data.path
      pageStatus.value = data.status ?? 'draft'
      pageSeo.value = data.seo ?? data.schema?.seo ?? {}
      schema.value = data.schema ?? {
        root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
      }
    }
  } catch (e) {
    // 不再静默回退；记录错误供 UI 显示重试卡片。
    loadError.value = (e as Error)?.message || '加载页面失败'
    schema.value = null
  } finally {
    loading.value = false
  }
}

/** V2-T2 SEO 更新：写 pageSeo + 同步 schema.seo（保证 schema 自洽） */
function onUpdateSeo(seo: PageSeo): void {
  pageSeo.value = seo
  if (schema.value) {
    schema.value.seo = seo
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
        seo: pageSeo.value,
      })
      ElMessage.success('创建成功')
      router.replace(`/sites/${siteId.value}/pages/${data.id}`)
    } else {
      await savePage(siteId.value, pageId.value, {
        name: pageName.value,
        path: pagePath.value,
        schema: schema.value,
        seo: pageSeo.value,
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
      seo: pageSeo.value,
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

function onSelect(id: string | null): void {
  selectedId.value = id
}

/**
 * 新增节点。parentId 未传或不存在时追加到 root.children；
 * 否则追加到对应容器的 children（仅当该 type 接受子节点）。
 * 新节点 props 由 meta.defaultProps 派生（无 meta 则空对象）。
 */
function onAddNode(type: string, parentId?: string): void {
  if (!schema.value?.root) return
  history.push()
  const meta = getComponentMeta(type)
  const defaultProps: Record<string, unknown> = meta?.defaultProps
    ? { ...meta.defaultProps }
    : {}
  const node: NodeSchema = {
    id: genId(type),
    type,
    props: defaultProps,
  }
  // 容器类型默认给空 children 数组，便于后续 drop
  if (isContainerType(type)) {
    node.children = []
  }

  let host: NodeSchema | null = schema.value.root
  if (parentId) {
    const found = findNode(schema.value.root, parentId)
    if (found && isContainerType(found.type)) {
      host = found
    }
  }
  if (!host.children) host.children = []
  host.children.push(node)
  selectedId.value = node.id
}

/**
 * LubanDesigner Sortable onEnd 触发的 root 级重排。
 * fromIdx/toIdx 均为 root.children 索引。
 */
function onReorder(fromIdx: number, toIdx: number): void {
  if (!schema.value) return
  history.push()
  reorderRootChildren(schema.value, fromIdx, toIdx)
}

/** 跨容器拖拽：moveNodeAcross 把节点移到目标容器（null=root 级），入撤销栈。 */
function onMoveNode(nodeId: string, _fromParentId: string | null, toParentId: string | null, toIdx: number): void {
  if (!schema.value?.root) return
  history.push()
  moveNodeAcross(schema.value.root, nodeId, toParentId, toIdx)
}

/** 属性面板回写 props。 */
function onUpdateProp(nodeId: string, key: string, value: unknown): void {
  if (!schema.value?.root) return
  const node = findNode(schema.value.root, nodeId)
  if (!node) return
  history.push()
  if (!node.props) node.props = {}
  node.props[key] = value
}

/** 属性面板事件分区回写：写 node.events[eventName]，入撤销栈。 */
function onUpdateEvent(nodeId: string, eventName: string, actionExpr: string): void {
  if (!schema.value?.root) return
  const node = findNode(schema.value.root, nodeId)
  if (!node) return
  history.push()
  if (!node.events) node.events = {}
  node.events[eventName] = actionExpr
}

/** 属性面板数据源分区回写：写 node.datasource，入撤销栈。 */
function onUpdateDatasource(nodeId: string, ds: { id: string; varName: string } | null): void {
  if (!schema.value?.root) return
  const node = findNode(schema.value.root, nodeId)
  if (!node) return
  history.push()
  node.datasource = ds ?? undefined
}

/**
 * D15-A3 属性面板样式分区回写：写 node.style[key]，入撤销栈。
 * 安全过滤已在 PropertyPanel.handleStyleInput 完成（拒绝 expression()/javascript: 等）。
 */
function onUpdateStyle(nodeId: string, key: string, value: string): void {
  if (!schema.value?.root) return
  const node = findNode(schema.value.root, nodeId)
  if (!node) return
  history.push()
  if (!node.style) node.style = {}
  if (value === '') {
    delete node.style[key]
  } else {
    node.style[key] = value
  }
}

/** V2-T5 属性面板动画分区回写：写 node.animation[key]，入撤销栈 */
function onUpdateAnimation(nodeId: string, key: string, value: unknown): void {
  if (!schema.value?.root) return
  const node = findNode(schema.value.root, nodeId)
  if (!node) return
  history.push()
  if (!node.animation) node.animation = {}
  ;(node.animation as Record<string, unknown>)[key] = value
}

/** 删除节点：root 不可删；删后清空选中。 */
function onDeleteNode(nodeId: string): void {
  if (!schema.value?.root) return
  if (schema.value.root.id === nodeId) return
  const node = findNode(schema.value.root, nodeId)
  // Y3：锁定节点不可删除
  if (node?.locked) return
  history.push()
  const ok = removeNode(schema.value.root, nodeId)
  if (ok && selectedId.value === nodeId) {
    selectedId.value = null
  }
}

/** Y3：切换节点锁定态（L 键 / ComponentTree 锁定按钮）。入撤销栈。 */
function onToggleLock(nodeId: string): void {
  if (!schema.value?.root) return
  const node = findNode(schema.value.root, nodeId)
  if (!node) return
  history.push()
  node.locked = !node.locked
}

/** Y3：切换节点隐藏态（H 键 / ComponentTree 隐藏按钮）。入撤销栈。 */
function onToggleHide(nodeId: string): void {
  if (!schema.value?.root) return
  const node = findNode(schema.value.root, nodeId)
  if (!node) return
  history.push()
  node.hidden = !node.hidden
}

/** 复制节点（属性面板 emit duplicate）。 */
function onDuplicateNode(nodeId: string): void {
  if (!schema.value?.root) return
  history.push()
  const node = findNode(schema.value.root, nodeId)
  const parent = findParent(schema.value.root, nodeId)
  if (!node || !parent || !parent.children) return
  // 浅克隆（深克隆 children 以免共享引用）
  const clone: NodeSchema = JSON.parse(JSON.stringify(node))
  clone.id = genId(node.type)
  const idx = parent.children.findIndex((c) => c.id === nodeId)
  parent.children.splice(idx + 1, 0, clone)
  selectedId.value = clone.id
}

/**
 * 组件树上移/下移：parentId 为 null 表示 root 级。
 * schemaTree.moveChild 的约定（parent:null ⟺ root 级）。
 */
function onMove(parentId: string | null, fromIdx: number, toIdx: number): void {
  if (!schema.value?.root) return
  history.push()
  const parent = parentId ? findNode(schema.value.root, parentId) : null
  // parent===null 且 parentId===null → root 级；其它情况 parent 必须命中
  if (parentId && !parent) return
  moveChild(parent, schema.value.root, fromIdx, toIdx)
}

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

// === D15-B1 数据源管理弹窗 ===
const datasourceDialogVisible = ref(false)
function openDatasourceDialog() {
  datasourceDialogVisible.value = true
}
/** 弹窗 CRUD 后刷新数据源下拉 */
function onDatasourceRefresh() {
  loadDatasources()
}
/** PropertyPanel 测试连通按钮（直连，复用 datasource API） */
async function onTestConnect(dsId: string) {
  try {
    const { data } = await testDatasource(dsId)
    if (data.ok) {
      ElMessage.success(`连通成功（${data.latencyMs ?? 0}ms）`)
    } else {
      ElMessage.warning(`连通失败：${data.message ?? '未知原因'}`)
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '测试连通失败')
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
  <div class="page-editor" :class="{ 'page-editor--designer': isDesignerMode }" v-loading="loading">
    <!-- 顶部 meta + 操作（标准模式） -->
    <ElCard v-if="!isDesignerMode" class="page-editor__meta" shadow="never">
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
        <ElFormItem>
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
        </ElFormItem>
      </ElForm>
    </ElCard>

    <!-- 全屏设计器顶栏（浮动） -->
    <div v-if="isDesignerMode" class="page-editor__designer-bar">
      <div class="page-editor__designer-bar-left">
        <ElButton text @click="goBack">← 返回页面列表</ElButton>
        <span class="page-editor__designer-title">{{ pageName || '未命名页面' }}</span>
        <ElTag :type="statusTagType(pageStatus)" size="small">
          {{ pageStatus === 'published' ? '已发布' : '草稿' }}
        </ElTag>
      </div>
      <div class="page-editor__designer-bar-center">
        <!-- V2-T4 断点切换器 -->
        <div v-if="responsiveEnabled" class="page-editor__breakpoints">
          <ElButton
            size="small"
            :type="currentBreakpoint === 'desktop' ? 'primary' : 'default'"
            title="桌面端 (desktop)"
            @click="setBreakpoint('desktop')"
          >💻 桌面</ElButton>
          <ElButton
            size="small"
            :type="currentBreakpoint === 'tablet' ? 'primary' : 'default'"
            title="平板端 (tablet, 768px)"
            @click="setBreakpoint('tablet')"
          >📱 平板</ElButton>
          <ElButton
            size="small"
            :type="currentBreakpoint === 'mobile' ? 'primary' : 'default'"
            title="手机端 (mobile, 375px)"
            @click="setBreakpoint('mobile')"
          >📱 手机</ElButton>
        </div>
        <span v-else class="page-editor__designer-path">{{ pagePath || '/' }}</span>
      </div>
      <div class="page-editor__designer-bar-right">
        <ElButton size="small" :disabled="!canUndo" title="撤销 (Ctrl+Z)" @click="history.undo()">↶</ElButton>
        <ElButton size="small" :disabled="!canRedo" title="重做 (Ctrl+Shift+Z)" @click="history.redo()">↷</ElButton>
        <ElButton size="small" :type="isDesign ? 'default' : 'primary'" @click="isDesign = !isDesign">
          {{ isDesign ? '预览' : '设计' }}
        </ElButton>
        <!-- V2-T8 版本历史入口 -->
        <ElButton
          v-if="versionHistoryEnabled"
          size="small"
          :disabled="isNew"
          title="版本历史与回滚"
          @click="versionHistoryVisible = true"
        >历史</ElButton>
        <ElButton size="small" type="primary" :loading="saving" @click="handleSave">
          {{ isNew ? '创建' : '保存' }}
        </ElButton>
        <ElButton size="small" type="success" :loading="publishing" :disabled="isNew" @click="handlePublish">
          发布
        </ElButton>
      </div>
    </div>

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
        <div class="page-editor__canvas-wrap" :style="{ maxWidth: canvasWidth }">
        <LubanDesigner
          v-if="isDesign"
          v-model:schema="schema"
          :design-mode="true"
          :show-toolbar="false"
          :breakpoint="currentBreakpoint"
          placeholder="从左侧拖拽组件到此处"
          @select="onSelect"
          @add-node="onAddNode"
          @reorder="onReorder"
          @move-node="onMoveNode"
        />
        <LubanPage v-else :schema="schema" :datasource-fetcher="datasourceFetcher" />
        </div>
      </ElMain>

      <ElAside width="300px" class="page-editor__aside page-editor__right">
        <ComponentTree
          :schema="schema"
          :selected-id="selectedId"
          :get-label="getLabel"
          @select="onSelect"
          @delete="onDeleteNode"
          @move="onMove"
          @lock="onToggleLock"
          @hide="onToggleHide"
        />
        <div class="page-editor__right-divider" />
        <PropertyPanel
          :node="selectedNode"
          :meta="selectedMeta"
          :datasources="datasources"
          :breakpoint="currentBreakpoint"
          @update:prop="onUpdateProp"
          @update:event="onUpdateEvent"
          @update:datasource="onUpdateDatasource"
          @update:style="onUpdateStyle"
          @update:animation="onUpdateAnimation"
          @delete="onDeleteNode"
          @duplicate="onDuplicateNode"
          @open-datasource="openDatasourceDialog"
          @test-connect="onTestConnect"
        />
        <!-- V2-T2 页面级 SEO 配置（FeatureGate 控制；独立分区） -->
        <template v-if="seoEnabled">
          <div class="page-editor__right-divider" />
          <PageSeoPanel :seo="pageSeo" @update:seo="onUpdateSeo" />
        </template>
      <!-- V2-T8 版本历史抽屉 -->
      <VersionHistory
        v-model="versionHistoryVisible"
        :site-id="siteId"
        :page-id="pageId || ''"
        @rollback="onVersionRollback"
      />
        <!-- D15-B1 数据源管理弹窗 -->
        <DatasourceManageDialog
          v-model="datasourceDialogVisible"
          :site-id="siteId"
          @refresh="onDatasourceRefresh"
        />
      </ElAside>
    </ElContainer>
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

  &__canvas-wrap {
    margin: 0 auto;
    transition: max-width 0.2s ease;
  }

  &__breakpoints {
    display: inline-flex;
    align-items: center;
    gap: 4px;
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

  // === 全屏设计器模式 ===
  &--designer {
    height: 100vh;
    overflow: hidden;

    .page-editor__workspace {
      border: none;
      border-radius: 0;
      height: calc(100vh - 48px);
    }

    .page-editor__aside {
      border-right: 1px solid #ebeef5;
    }
  }

  &__designer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 16px;
    background: #fff;
    border-bottom: 1px solid #ebeef5;
    flex-shrink: 0;
  }

  &__designer-bar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 200px;
  }

  &__designer-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  &__designer-bar-center {
    flex: 1;
    text-align: center;
  }

  &__designer-path {
    font-size: 12px;
    color: #909399;
    font-family: monospace;
  }

  &__designer-bar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 200px;
    justify-content: flex-end;
  }
}
</style>
