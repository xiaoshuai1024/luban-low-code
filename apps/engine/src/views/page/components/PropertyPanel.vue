<script setup lang="ts">
/**
 * PropertyPanel.vue — 选中节点的属性编辑面板。
 *
 * 根据 node.type 对应的 ComponentMeta.propSchema 逐项渲染控件，
 * 控件值双向绑定到 node.props[key]，change 时 emit `update:prop`。
 * 底部提供"删除节点"操作。
 *
 * 依赖：
 * - Element Plus（ElForm/ElFormItem/ElInput/ElInputNumber/ElSwitch/ElSelect/ElOption/ElButton）。
 *   main.ts 已 app.use(ElementPlus)，模板内全局组件可用。
 * - ComponentMeta / PropSchemaItem 类型来自 luban-low-code（dist/index.d.ts 已导出）。
 *   运行时由调用方传入 meta（通常 getComponentMeta(node.type) 的返回）。
 * - NodeSchema 来自 engine 本地 @/types/schema（与 PageEditor.vue 一致）。
 */
import { computed } from 'vue'
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSwitch,
  ElSelect,
  ElOption,
  ElButton,
  ElEmpty,
  ElColorPicker,
  ElCollapse,
  ElCollapseItem,
  ElRadioGroup,
  ElRadio,
} from 'element-plus'
import type { NodeSchema } from '@/types/schema'
import type { ComponentMeta, PropSchemaItem } from 'luban-low-code'
import { useFeatureGate } from '@/composables/useFeatureGate'

interface DatasourceOption {
  id: string
  name: string
}

interface Props {
  node: NodeSchema | null
  meta: ComponentMeta | null
  /** 当前 site 可用的数据源列表（PageEditor 加载传入） */
  datasources?: DatasourceOption[]
  readonly?: boolean
  /** V2-T4 当前断点：决定样式分区写入 node.style（desktop）还是 node.responsive[bp] */
  breakpoint?: ResponsiveBreakpoint
}

const props = withDefaults(defineProps<Props>(), {
  node: null,
  meta: null,
  datasources: () => [],
  readonly: false,
  breakpoint: 'desktop',
})

/** V2-T7 collection 选项（id + name） */
interface CollectionOption {
  id: string
  name: string
}

const emit = defineEmits<{
  (e: 'update:prop', nodeId: string, key: string, value: unknown): void
  (e: 'update:event', nodeId: string, eventName: string, actionExpr: string): void
  (e: 'update:datasource', nodeId: string, datasource: { id: string; varName: string } | null): void
  (e: 'delete', nodeId: string): void
  (e: 'duplicate', nodeId: string): void
  /** D15-B1：打开数据源管理弹窗 */
  (e: 'open-datasource'): void
  /** D15-B1：测试指定数据源连通 */
  (e: 'test-connect', datasourceId: string): void
  /** D15-A3：节点级样式更新（key 为 CSS 属性名，value 为值） */
  (e: 'update:style', nodeId: string, key: string, value: string): void
  /** V2-T5：节点动画更新（key 为 animation 字段名，value 为值） */
  (e: 'update:animation', nodeId: string, key: string, value: unknown): void
  /** V2-T7：节点 CMS 绑定更新（整体 cmsBinding 已写回 node） */
  (e: 'update:cms-binding', nodeId: string): void
}>()

// FeatureGate §6.5: 数据源/事件分区可按开关隐藏（回滚链依赖）。
const { isEnabled: isFeatureEnabled } = useFeatureGate()
const featureDatasource = isFeatureEnabled('editor.datasource')
const featureEvents = isFeatureEnabled('editor.events')

/** 有序的 propSchema 条目，便于稳定渲染。 */
const schemaEntries = computed<Array<[string, PropSchemaItem]>>(() => {
  if (!props.meta || !props.meta.propSchema) return []
  return Object.entries(props.meta.propSchema)
})

/**
 * 节点 props 容器：保证返回非空对象（若 node.props 缺失则用空对象视图层兜底，
 * 不在此处产生写副作用）。真正写入在 handleInput 时进行（含惰性初始化）。
 */
const nodeProps = computed<Record<string, unknown>>(() => {
  if (!props.node) return {}
  return props.node.props ?? {}
})

/** 确保节点有 props 容器并返回其引用（写操作入口）。 */
function ensureProps(): Record<string, unknown> | null {
  if (!props.node) return null
  if (!props.node.props) {
    props.node.props = {}
  }
  return props.node.props
}

function getValue(key: string, item: PropSchemaItem): unknown {
  const v = nodeProps.value[key]
  if (v === undefined || v === null) return item.default ?? null
  return v
}

function handleInput(key: string, value: unknown): void {
  const target = ensureProps()
  if (!target) return
  target[key] = value
  if (props.node) {
    emit('update:prop', props.node.id, key, value)
  }
}

// === options 类型：选项列表（{ label, value }[]）的内联编辑 ===
interface OptionItem {
  label: string
  value: string
}

function getOptions(key: string): OptionItem[] {
  const raw = nodeProps.value[key]
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    if (typeof r === 'string') return { label: r, value: r }
    if (r && typeof r === 'object') {
      const o = r as { label?: unknown; value?: unknown }
      return {
        label: typeof o.label === 'string' ? o.label : String(o.value ?? ''),
        value: typeof o.value === 'string' ? o.value : String(o.value ?? ''),
      }
    }
    return { label: String(r), value: String(r) }
  })
}

function updateOptionItem(key: string, index: number, field: 'label' | 'value', val: string): void {
  const list = getOptions(key)
  if (index < 0 || index >= list.length) return
  list[index] = { ...list[index], [field]: val }
  commitOptions(key, list)
}

function addOption(key: string): void {
  const list = getOptions(key)
  const next = `option_${list.length + 1}`
  list.push({ label: next, value: next })
  commitOptions(key, list)
}

function removeOption(key: string, index: number): void {
  const list = getOptions(key)
  if (index < 0 || index >= list.length) return
  list.splice(index, 1)
  commitOptions(key, list)
}

function commitOptions(key: string, list: OptionItem[]): void {
  handleInput(key, list.map((o) => ({ label: o.label, value: o.value })))
}

// === array 类型：可视化数组编辑器（D15-E0 engine 消费侧）===
// itemFields 由 compat.ts 从 JSONSchema items.properties 派生；按 itemFields
// 渲染每行 N 字段输入，复用 options 编辑器的增删行模式。
interface ArrayRow {
  [field: string]: unknown
}

/** 读取数组当前行列表（归一化为对象数组；非数组/空 → []）。 */
function getArrayItems(key: string): ArrayRow[] {
  const raw = nodeProps.value[key]
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    if (r && typeof r === 'object') return r as ArrayRow
    return { value: r }
  })
}

/** 按 itemFields 默认值构造一行。 */
function defaultArrayRow(itemFields?: PropSchema): ArrayRow {
  const row: ArrayRow = {}
  if (itemFields) {
    for (const [k, f] of Object.entries(itemFields) as [string, PropSchemaItem][]) {
      row[k] = f.default ?? (f.type === 'number' ? 0 : f.type === 'boolean' ? false : '')
    }
  }
  return row
}

function addArrayItem(key: string, itemFields?: PropSchema): void {
  const list = getArrayItems(key)
  list.push(defaultArrayRow(itemFields))
  handleInput(key, list)
}

function removeArrayItem(key: string, index: number): void {
  const list = getArrayItems(key)
  if (index < 0 || index >= list.length) return
  list.splice(index, 1)
  handleInput(key, list)
}

function updateArrayItem(key: string, index: number, field: string, val: unknown): void {
  const list = getArrayItems(key)
  if (index < 0 || index >= list.length) return
  list[index] = { ...list[index], [field]: val }
  handleInput(key, list)
}

// === json 类型：textarea + 解析容错 ===
function getJsonText(key: string): string {
  const v = nodeProps.value[key]
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return ''
  }
}

function handleJsonInput(key: string, text: string): void {
  // 先存原始字符串；若可解析则存对象，否则存字符串（避免覆盖用户正在编辑的非法 JSON）。
  let parsed: unknown = text
  if (text.trim() !== '') {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  handleInput(key, parsed)
}

// === 样式分区（D15-A3，W1-T7）：节点级 style 配置 ===
/**
 * V2-T4：样式分区标题携带当前断点提示。
 * desktop = "样式"；tablet/mobile = "样式（平板）"/"样式（手机）"。
 */
const styleSectionLabel = computed(() => {
  if (!responsiveEnabled) return '样式';
  const bpLabel: Record<ResponsiveBreakpoint, string> = {
    desktop: '样式',
    tablet: '样式（平板）',
    mobile: '样式（手机）',
  };
  return bpLabel[props.breakpoint];
});

/**
 * 危险 CSS 值过滤（§8.2 安全 A03）：拒绝 expression()/javascript:/url(javascript:)
 * 等可能在旧浏览器执行的注入向量。值在写入 node.style 前先过此函数。
 */
const DANGEROUS_CSS_PATTERNS = [
  /expression\s*\(/i,
  /javascript:/i,
  /url\s*\(\s*['"]?\s*javascript:/i,
  /-moz-binding/i,
  /behavior\s*:/i,
]
function isSafeCssValue(value: string): boolean {
  if (typeof value !== 'string') return false
  for (const re of DANGEROUS_CSS_PATTERNS) {
    if (re.test(value)) return false
  }
  return true
}

/**
 * V2-T4：按当前断点定位样式源对象。
 * desktop → node.style（基础）；tablet/mobile → node.responsive[bp]（惰性初始化）。
 * 返回引用，调用方直接写键值；新增的对象会挂回 node.responsive。
 */
function resolveStyleTarget(): Record<string, string> | null {
  if (!props.node) return null;
  if (props.breakpoint === 'desktop') {
    if (!props.node.style) props.node.style = {};
    return props.node.style;
  }
  // tablet/mobile
  if (!props.node.responsive) props.node.responsive = {};
  const bp = props.breakpoint;
  if (bp === 'tablet') {
    if (!props.node.responsive.tablet) props.node.responsive.tablet = {};
    return props.node.responsive.tablet;
  }
  if (!props.node.responsive.mobile) props.node.responsive.mobile = {};
  return props.node.responsive.mobile;
}

/** 读取节点某 CSS 属性值（按当前断点：desktop=style，其它=responsive[bp]）。 */
function getStyleValue(key: string): string {
  if (!props.node) return '';
  if (props.breakpoint === 'desktop') {
    return (props.node.style?.[key] as string) ?? '';
  }
  const r = props.node.responsive;
  if (!r) return '';
  const bpStyles = props.breakpoint === 'tablet' ? r.tablet : r.mobile;
  return (bpStyles?.[key] as string) ?? '';
}

/**
 * 写入节点 CSS 属性（按当前断点）：安全过滤后写，emit update:style。
 * desktop → node.style；tablet/mobile → node.responsive[bp]。
 * 危险值静默丢弃（不写不 emit）。
 */
function handleStyleInput(key: string, value: string): void {
  if (!props.node) return;
  if (value && !isSafeCssValue(value)) return; // 危险值拒绝
  const target = resolveStyleTarget();
  if (!target) return;
  if (value === '') {
    delete target[key];
  } else {
    target[key] = value;
  }
  emit('update:style', props.node.id, key, value);
}

/** 预设阴影选项（boxShadow） */
const SHADOW_PRESETS = [
  { label: '无', value: '' },
  { label: '小', value: '0 1px 3px rgba(0,0,0,0.12)' },
  { label: '中', value: '0 4px 12px rgba(0,0,0,0.15)' },
  { label: '大', value: '0 10px 30px rgba(0,0,0,0.2)' },
]

// === V2-T5 动画分区 ===
const ANIMATION_TYPES: { label: string; value: AnimationType }[] = [
  { label: '淡入 (fade)', value: 'fade' },
  { label: '上滑 (slide-up)', value: 'slide-up' },
  { label: '左滑 (slide-left)', value: 'slide-left' },
  { label: '缩放 (zoom)', value: 'zoom' },
  { label: '翻转 (flip)', value: 'flip' },
]
const ANIMATION_TRIGGERS: { label: string; value: AnimationTrigger }[] = [
  { label: '进入视口 (in-view)', value: 'in-view' },
  { label: '悬停 (hover)', value: 'hover' },
  { label: '加载 (load)', value: 'load' },
]

/** V2-T5 物料能力约束：若物料声明了 animationTriggers，仅显示声明的 trigger；
 * 未声明则全部显示（向后兼容） */
const availableTriggers = computed(() => {
  const allowed = props.meta?.capabilities?.animationTriggers
  if (!allowed || allowed.length === 0) return ANIMATION_TRIGGERS
  return ANIMATION_TRIGGERS.filter((t) => allowed.includes(t.value))
})

function getAnimValue(key: string): unknown {
  return props.node?.animation?.[key as keyof typeof props.node.animation]
}

/** 写入节点 animation 字段：惰性初始化 animation 对象，emit update:animation */
function handleAnimInput(key: string, value: unknown): void {
  if (!props.node) return
  if (!props.node.animation) props.node.animation = {}
  ;(props.node.animation as Record<string, unknown>)[key] = value
  emit('update:animation', props.node.id, key, value)
}

/** 清除动画配置（type 设空即视为无动画，渲染零输出） */
function clearAnimation(): void {
  if (!props.node) return
  if (!props.node.animation) return
  props.node.animation = undefined
  emit('update:animation', props.node.id, 'type', undefined)
}

// === V2-T7 CMS 绑定分区 ===
/** 当前节点绑定的 collectionId / fieldKey / mode（v-model 友好） */
const cmsCollectionId = computed<string>({
  get: () => props.node?.cmsBinding?.collectionId ?? '',
  set: (v: string) => setCmsField('collectionId', v),
})
const cmsFieldKey = computed<string>({
  get: () => props.node?.cmsBinding?.fieldKey ?? 'title',
  set: (v: string) => setCmsField('fieldKey', v),
})
const cmsMode = computed<'single' | 'list'>({
  get: () => props.node?.cmsBinding?.mode ?? 'single',
  set: (v: 'single' | 'list') => setCmsField('mode', v),
})

/** 写入 node.cmsBinding[key]，惰性初始化 cmsBinding 对象 */
function setCmsField(key: string, value: unknown): void {
  if (!props.node) return
  if (!props.node.cmsBinding) {
    props.node.cmsBinding = { collectionId: '' }
  }
  ;(props.node.cmsBinding as unknown as Record<string, unknown>)[key] = value
  emit('update:cms-binding', props.node.id)
}

/** 解绑 CMS */
function clearCmsBinding(): void {
  if (!props.node) return
  props.node.cmsBinding = undefined
  emit('update:cms-binding', props.node.id)
}

function handleDelete(): void {
  if (!props.node) return
  emit('delete', props.node.id)
}

function handleDuplicate(): void {
  if (!props.node) return
  emit('duplicate', props.node.id)
}

// === 事件分区（W1-T5）：按 meta.events 配动作表达式 ===
/** 物料声明的事件名列表（componentMeta.events，compat 后可能为 string[] 或 {name}[]）。 */
const eventNames = computed<string[]>(() => {
  if (!props.meta) return []
  const ev = (props.meta as { events?: unknown }).events
  if (!Array.isArray(ev)) return []
  return ev
    .map((e) => (typeof e === 'string' ? e : (e as { name?: string })?.name ?? ''))
    .filter(Boolean)
})

function getEventAction(eventName: string): string {
  if (!props.node?.events) return ''
  return props.node.events[eventName] ?? ''
}

function handleEventInput(eventName: string, actionExpr: string): void {
  if (!props.node) return
  if (!props.node.events) props.node.events = {}
  props.node.events[eventName] = actionExpr
  emit('update:event', props.node.id, eventName, actionExpr)
}

// === 数据源分区（W1-T5）：绑 datasource + varName，运行时注入表达式上下文 ===
function getCurrentDatasourceId(): string {
  return props.node?.datasource?.id ?? ''
}
function getCurrentVarName(): string {
  return props.node?.datasource?.varName ?? ''
}
function handleDatasourceIdChange(id: string): void {
  if (!props.node) return
  const varName = props.node.datasource?.varName ?? 'data'
  if (id) {
    if (!props.node.datasource) {
      props.node.datasource = { id, varName }
    } else {
      props.node.datasource.id = id
    }
    emit('update:datasource', props.node.id, { id, varName: props.node.datasource.varName })
  } else {
    props.node.datasource = undefined
    emit('update:datasource', props.node.id, null)
  }
}
function handleVarNameChange(varName: string): void {
  if (!props.node || !props.node.datasource) return
  props.node.datasource.varName = varName
  emit('update:datasource', props.node.id, { ...props.node.datasource })
}
</script>

<template>
  <div class="property-panel">
    <div class="property-panel__header">
      <span class="property-panel__title">属性</span>
      <span v-if="meta" class="property-panel__type">{{ meta.label }}（{{ node?.type }}）</span>
    </div>

    <ElEmpty
      v-if="!node"
      description="选中画布组件以编辑属性"
      :image-size="80"
    />

    <ElForm v-else label-position="top" size="small" :disabled="readonly">
      <ElFormItem
        v-for="[key, item] in schemaEntries"
        :key="key"
        :label="item.label || key"
      >
        <!-- string -->
        <ElInput
          v-if="item.type === 'string'"
          :model-value="String(getValue(key, item) ?? '')"
          :placeholder="`请输入${item.label || key}`"
          @update:model-value="(v: string) => handleInput(key, v)"
        />

        <!-- number -->
        <ElInputNumber
          v-else-if="item.type === 'number'"
          :model-value="Number(getValue(key, item) ?? 0)"
          controls-position="right"
          @update:model-value="(v?: number) => handleInput(key, v)"
        />

        <!-- boolean -->
        <ElSwitch
          v-else-if="item.type === 'boolean'"
          :model-value="Boolean(getValue(key, item))"
          @update:model-value="(v: string | number | boolean) => handleInput(key, v)"
        />

        <!-- select -->
        <ElSelect
          v-else-if="item.type === 'select'"
          :model-value="getValue(key, item) as string | number | boolean | Record<string, unknown>"
          :placeholder="`请选择${item.label || key}`"
          style="width: 100%"
          @update:model-value="(v: unknown) => handleInput(key, v)"
        >
          <ElOption
            v-for="opt in item.options || []"
            :key="String(opt.value)"
            :label="opt.label"
            :value="opt.value"
          />
        </ElSelect>

        <!-- options（内联列表编辑器） -->
        <div v-else-if="item.type === 'options'" class="property-panel__options">
          <div
            v-for="(opt, idx) in getOptions(key)"
            :key="idx"
            class="property-panel__option-row"
          >
            <ElInput
              :model-value="opt.label"
              placeholder="标签"
              size="small"
              style="flex: 1"
              @update:model-value="(v: string) => updateOptionItem(key, idx, 'label', v)"
            />
            <ElInput
              :model-value="opt.value"
              placeholder="值"
              size="small"
              style="flex: 1"
              @update:model-value="(v: string) => updateOptionItem(key, idx, 'value', v)"
            />
            <ElButton
              size="small"
              type="danger"
              link
              :disabled="readonly"
              @click="removeOption(key, idx)"
            >
              删除
            </ElButton>
          </div>
          <ElButton
            size="small"
            type="primary"
            link
            :disabled="readonly"
            @click="addOption(key)"
          >
            + 添加选项
          </ElButton>
        </div>

        <!-- array（D15-E0 可视化数组编辑器：按 itemFields 渲染每行 N 字段） -->
        <div v-else-if="item.type === 'array'" class="property-panel__array">
          <div
            v-for="(row, idx) in getArrayItems(key)"
            :key="idx"
            class="property-panel__array-row"
          >
            <div class="property-panel__array-fields">
              <template v-if="item.itemFields">
                <template v-for="(field, fName) in item.itemFields" :key="fName">
                  <ElInput
                    v-if="field.type === 'string' || !field.type"
                    :model-value="String(row[fName] ?? '')"
                    :placeholder="field.label || String(fName)"
                    size="small"
                    @update:model-value="(v: string) => updateArrayItem(key, idx, String(fName), v)"
                  />
                  <ElInputNumber
                    v-else-if="field.type === 'number'"
                    :model-value="Number(row[fName] ?? 0)"
                    size="small"
                    controls-position="right"
                    @update:model-value="(v?: number) => updateArrayItem(key, idx, String(fName), v ?? 0)"
                  />
                  <ElSwitch
                    v-else-if="field.type === 'boolean'"
                    :model-value="Boolean(row[fName])"
                    @update:model-value="(v: string | number | boolean) => updateArrayItem(key, idx, String(fName), v)"
                  />
                  <ElSelect
                    v-else-if="field.type === 'select'"
                    :model-value="(row[fName] as string | number | boolean)"
                    :placeholder="field.label || String(fName)"
                    size="small"
                    style="flex: 1"
                    @update:model-value="(v: string | number | boolean) => updateArrayItem(key, idx, String(fName), v)"
                  >
                    <ElOption v-for="opt in field.options || []" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
                  </ElSelect>
                </template>
              </template>
            </div>
            <ElButton size="small" type="danger" link :disabled="readonly" @click="removeArrayItem(key, idx)">删除</ElButton>
          </div>
          <ElButton size="small" type="primary" link :disabled="readonly" @click="addArrayItem(key, item.itemFields)">+ 添加</ElButton>
        </div>

        <!-- json -->
        <ElInput
          v-else-if="item.type === 'json'"
          :model-value="getJsonText(key)"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 10 }"
          placeholder="JSON"
          @update:model-value="(v: string) => handleJsonInput(key, v)"
        />

        <!-- 兜底：未知类型用文本 -->
        <ElInput
          v-else
          :model-value="String(getValue(key, item) ?? '')"
          @update:model-value="(v: string) => handleInput(key, v)"
        />
      </ElFormItem>

      <!-- 事件分区：按 meta.events 配动作表达式（W1-T5） -->
      <ElFormItem v-if="featureEvents && eventNames.length" label="事件动作">
        <div class="property-panel__events">
          <div v-for="ev in eventNames" :key="ev" class="property-panel__event-row">
            <span class="property-panel__event-name">{{ ev }}</span>
            <ElInput
              :model-value="getEventAction(ev)"
              placeholder="动作表达式，如 navigate('/x')"
              size="small"
              @update:model-value="(v: string) => handleEventInput(ev, v)"
            />
          </div>
        </div>
      </ElFormItem>

      <!-- 数据源分区：绑 datasource + varName（W1-T5） -->
      <ElFormItem v-if="featureDatasource && datasources.length" label="数据源">
        <div class="property-panel__datasource">
          <ElSelect
            :model-value="getCurrentDatasourceId()"
            placeholder="选择数据源"
            size="small"
            style="width: 100%"
            @update:model-value="(v: string) => handleDatasourceIdChange(v)"
          >
            <ElOption v-for="ds in datasources" :key="ds.id" :label="ds.name" :value="ds.id" />
          </ElSelect>
          <ElInput
            v-if="getCurrentDatasourceId()"
            :model-value="getCurrentVarName()"
            placeholder="变量名（默认 data）"
            size="small"
            @update:model-value="(v: string) => handleVarNameChange(v)"
          />
        </div>
      </ElFormItem>
    </ElForm>

    <div v-if="node && !readonly" class="property-panel__footer">
      <ElButton size="small" @click="handleDuplicate">复制节点</ElButton>
      <ElButton size="small" type="danger" @click="handleDelete">删除节点</ElButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid #ebeef5;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  &__type {
    font-size: 12px;
    color: #909399;
  }

  &__options {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  &__option-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  &__events {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  &__event-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__event-name {
    font-size: 12px;
    color: #606266;
  }

  &__datasource {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;
  }

  // === V2-T5 动画分区 ===
  &__animation {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  &__anim-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  &__anim-label {
    font-size: 12px;
    color: #606266;
    flex-shrink: 0;
    min-width: 56px;
  }

  &__anim-hint {
    font-size: 11px;
    color: #909399;
  }

  // === V2-T7 CMS 绑定分区 ===
  &__cms {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  &__cms-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  &__cms-label {
    font-size: 12px;
    color: #606266;
    flex-shrink: 0;
    min-width: 40px;
  }

  &__cms-hint {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
  }
}
</style>
