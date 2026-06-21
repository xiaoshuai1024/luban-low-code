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
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
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
import type { ResponsiveBreakpoint } from 'luban-low-code'
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
/** 是否在全屏设计器模式（独立路由 /designer/...，无侧边栏/顶栏） */
const isDesignerMode = computed(() => Boolean(route.meta.designer))

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
/** V2-T11 多选：所有选中节点 ID（单选时含 1 个；selectedId 为主要焦点） */
const selectedIds = ref<string[]>([])
/** V2-T11 多选 FeatureGate */
const multiSelectEnabled = isFeatureEnabled('multiSelect')
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

/** 面板搜索过滤 */
const paletteSearch = ref('')
/** 折叠的分类集合 */
const collapsedCategories = ref<Set<string>>(new Set())
function toggleCategory(cat: string) {
  if (collapsedCategories.value.has(cat)) {
    collapsedCategories.value.delete(cat)
  } else {
    collapsedCategories.value.add(cat)
  }
}

/** 搜索过滤后的分组（空分组隐藏，空搜索则全显示） */
const filteredPaletteGroups = computed(() => {
  const q = paletteSearch.value.trim().toLowerCase()
  if (!q) return paletteGroups.value
  return paletteGroups.value
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.type.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.items.length > 0)
})

/** 组件类型 → SVG 图标（精简 20x20 viewBox） */
const COMPONENT_ICONS: Record<string, string> = {
  // 信息
  LubanButton: '<rect x="2" y="5" width="16" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.5"/>',
  LubanText: '<line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="14" x2="10" y2="14" stroke="currentColor" stroke-width="1.5"/>',
  LubanBanner: '<rect x="2" y="3" width="16" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><polyline points="4,15 7,12 9,13 13,9 16,11" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  LubanContentList: '<rect x="2" y="3" width="16" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="8" width="16" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="13" width="16" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  // 布局
  LubanContainer: '<rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>',
  LubanRow: '<rect x="2" y="5" width="16" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="5" x2="10" y2="15" stroke="currentColor" stroke-width="1.2"/>',
  LubanCol: '<rect x="2" y="2" width="7" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="2" width="7" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  LubanSidePanel: '<rect x="12" y="2" width="6" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="2" width="8" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  // 表单
  LubanForm: '<rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="5" y1="11" x2="12" y2="11" stroke="currentColor" stroke-width="1.2"/>',
  LubanInput: '<rect x="2" y="7" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="10" x2="8" y2="10" stroke="currentColor" stroke-width="1.2"/>',
  LubanTextArea: '<rect x="2" y="5" width="16" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.2"/><line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.2"/>',
  LubanSelect: '<rect x="2" y="7" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="5,12 10,16 15,12" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  LubanCheckbox: '<rect x="3" y="7" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="5,10 7,12 10,8" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  LubanRadioGroup: '<circle cx="7" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="10" r="1.5" fill="currentColor"/><line x1="12" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.3"/>',
  LubanSwitch: '<rect x="2" y="6" width="16" height="8" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="10" r="3" fill="currentColor"/>',
  // 营销
  LubanHero: '<rect x="2" y="2" width="16" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="6" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="11" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="11" y="11" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  LubanCTA: '<rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="11" width="8" height="4" rx="2" fill="currentColor" opacity="0.3"/>',
  LubanTestimonial: '<circle cx="5" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="1.3"/><line x1="4" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1.3"/>',
  LubanTestimonialCarousel: '<circle cx="4" cy="4" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="3" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="4" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  LubanLeadCapture: '<rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="5" y="5" width="10" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="5" y="11" width="10" height="3" rx="1" fill="currentColor" opacity="0.3"/>',
  LubanNavbar: '<rect x="2" y="2" width="16" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="4" r="1.5" fill="currentColor" opacity="0.6"/><line x1="8" y1="4" x2="10" y2="4" stroke="currentColor" stroke-width="1.2"/>',
  LubanFooter: '<line x1="2" y1="2" x2="18" y2="2" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="1.2"/>',
  LubanFeatureGrid: '<rect x="2" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  LubanPricing: '<rect x="2" y="4" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.2"/><line x1="6" y1="12" x2="12" y2="12" stroke="currentColor" stroke-width="1.3"/>',
  LubanFAQ: '<circle cx="5" cy="5" r="1.2" fill="currentColor"/><line x1="8" y1="5" x2="16" y2="5" stroke="currentColor" stroke-width="1.2"/><circle cx="5" cy="10" r="1.2" fill="currentColor"/><line x1="8" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.2"/>',
  LubanGallery: '<rect x="2" y="2" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="2" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="11" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  LubanLogoCloud: '<circle cx="5" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="15" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  LubanStats: '<rect x="2" y="10" width="4" height="8" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="5" width="4" height="13" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="14" y="7" width="4" height="11" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  // 导航
  LubanMenu: '<rect x="2" y="3" width="16" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="8" width="14" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="13" width="11" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  LubanTabs: '<line x1="2" y1="3" x2="18" y2="3" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="6" width="5" height="2" rx="1" fill="currentColor"/><rect x="9" y="6" width="5" height="2" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  // 反馈
  LubanModal: '<rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="13" y1="5" x2="17" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="17" y1="5" x2="13" y2="9" stroke="currentColor" stroke-width="1.5"/>',
  LubanDrawer: '<rect x="2" y="2" width="12" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="16" y1="6" x2="18" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="18" y1="6" x2="16" y2="8" stroke="currentColor" stroke-width="1.5"/>',
  LubanToast: '<rect x="5" y="8" width="10" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="8" y1="11" x2="12" y2="11" stroke="currentColor" stroke-width="1.2"/>',
  // 数据展示
  LubanTable: '<rect x="2" y="2" width="16" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="7" x2="18" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="8" y1="7" x2="8" y2="18" stroke="currentColor" stroke-width="1.2"/>',
}

function getComponentIcon(type: string): string {
  return COMPONENT_ICONS[type] || '<rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>'
}

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
        <!-- V2-T11 多选批量操作栏（选中 ≥2 显示） -->
        <div v-if="multiSelectEnabled && selectedIds.length > 1" class="page-editor__multiselect-bar">
          <ElTag size="small" type="info">已选 {{ selectedIds.length }}</ElTag>
          <ElButton size="small" @click="onBatchDuplicate">复制</ElButton>
          <ElButton size="small" @click="onBatchAlign('left')">左对齐</ElButton>
          <ElButton size="small" @click="onBatchAlign('center')">居中</ElButton>
          <ElButton size="small" type="danger" @click="onBatchDelete">删除</ElButton>
          <ElButton size="small" text @click="onClearSelection">取消选择</ElButton>
        </div>
        <ElButton v-else-if="multiSelectEnabled && selectedId && selectedId !== schema?.root?.id" size="small" text @click="onSelectAllSiblings">全选同级</ElButton>
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
        <!-- V2-T9 出码导出入口（下拉：单文件 / 多文件包） -->
        <ElDropdown v-if="exportEnabled" trigger="click" @command="(cmd: string) => cmd === 'package' ? onExportPackage() : onExportHtml()">
          <ElButton size="small" title="导出静态页">导出 ▾</ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem command="html">单文件 HTML（内联，推荐）</ElDropdownItem>
              <ElDropdownItem command="package">多文件包（index.html + assets/）</ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
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
      <ElAside width="240px" class="page-editor__aside page-editor__palette">
        <div class="page-editor__panel-title">组件</div>
        <!-- 搜索框 -->
        <div class="page-editor__palette-search">
          <input
            v-model="paletteSearch"
            class="page-editor__palette-search-input"
            placeholder="搜索组件..."
          />
        </div>
        <!-- 分类列表 -->
        <div class="page-editor__palette-body">
          <div
            v-for="group in filteredPaletteGroups"
            :key="group.category"
            class="page-editor__palette-group"
          >
            <button
              class="page-editor__palette-cat"
              @click="toggleCategory(group.category)"
            >
              <svg class="page-editor__palette-cat-arrow" :class="{ 'page-editor__palette-cat-arrow--open': !collapsedCategories.has(group.category) }" viewBox="0 0 16 16" width="12" height="12">
                <path d="M6 4 L10 8 L6 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>{{ group.category }}</span>
              <span class="page-editor__palette-cat-count">{{ group.items.length }}</span>
            </button>
            <div v-show="!collapsedCategories.has(group.category)" class="page-editor__palette-items">
              <div
                v-for="item in group.items"
                :key="item.type"
                class="page-editor__palette-item"
                draggable="true"
                @dragstart="(e) => onPaletteDragStart(e, item.type)"
              >
                <span class="page-editor__palette-item-icon-text">{{ item.label.charAt(0) }}</span>
                <span class="page-editor__palette-item-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
          <div v-if="filteredPaletteGroups.length === 0" class="page-editor__palette-empty">
            未找到匹配的组件
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
    display: flex;
    flex-direction: column;
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
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  &__breakpoints {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__multiselect-bar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    background: #ecf5ff;
    border-radius: 4px;
  }

  &__panel-title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
    padding: 10px 12px;
    border-bottom: 1px solid #ebeef5;
    flex-shrink: 0;
  }

  &__palette-search {
    padding: 8px 10px;
    flex-shrink: 0;
    border-bottom: 1px solid #ebeef5;
  }

  &__palette-search-input {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 12px;
    color: #303133;
    background: #fff;
    outline: none;
    box-sizing: border-box;

    &::placeholder {
      color: #c0c4cc;
    }

    &:focus {
      border-color: #409eff;
    }
  }

  &__palette-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  &__palette-group {
    // group wrapper, no extra padding
  }

  &__palette-cat {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: none;
    font-size: 11.5px;
    font-weight: 600;
    color: #909399;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    text-align: left;

    &:hover {
      color: #606266;
      background: #f5f7fa;
    }
  }

  &__palette-cat-arrow {
    flex-shrink: 0;
    color: #c0c4cc;
    transition: transform 0.15s ease;
  }

  &__palette-cat-arrow--open {
    transform: rotate(90deg);
    color: #909399;
  }

  &__palette-cat-count {
    margin-left: auto;
    font-size: 10px;
    color: #c0c4cc;
    font-weight: 400;
  }

  &__palette-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 2px 10px 8px;
  }

  &__palette-item {
    user-select: none;
    cursor: grab;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    font-size: 12px;
    color: #606266;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;

    &:hover {
      border-color: #409eff;
      color: #409eff;
      background: #ecf5ff;
      box-shadow: 0 1px 3px rgba(64, 158, 255, 0.12);
    }

    &:active {
      cursor: grabbing;
      transform: scale(0.97);
    }
  }

  &__palette-item-icon {
    flex-shrink: 0;
    color: #909399;
    transition: color 0.15s;
  }

  &__palette-item:hover &__palette-item-icon {
    color: #409eff;
  }

  &__palette-item-icon-text {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: #909399;
    border-radius: 4px;
    transition: background 0.15s;
  }

  &__palette-item:hover &__palette-item-icon-text {
    background: #409eff;
  }

  &__palette-item-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__palette-empty {
    padding: 24px 12px;
    text-align: center;
    color: #c0c4cc;
    font-size: 12px;
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
