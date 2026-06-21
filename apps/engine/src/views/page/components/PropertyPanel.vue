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
} from 'element-plus'
import type { NodeSchema } from '@/types/schema'
import type { ComponentMeta, PropSchemaItem, PropSchema } from 'luban-low-code'
import type { ResponsiveBreakpoint, AnimationType, AnimationTrigger } from 'luban-low-code'
import { isFeatureEnabled } from '@/config/features'

/** D15-B1 数据源管理/测试连通开关（FeatureGate） */
const datasourceManageEnabled = isFeatureEnabled('datasourceManage')
const testConnectEnabled = isFeatureEnabled('testConnect')
/** D15-A3 样式面板开关（FeatureGate） */
const styleEnabled = isFeatureEnabled('style')
/** V2-T4 响应式开关（FeatureGate） */
const responsiveEnabled = isFeatureEnabled('responsive')
/** V2-T5 动画开关（FeatureGate） */
const animationEnabled = isFeatureEnabled('animation')

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
}>()

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

      <!-- D15-A3 样式分区（5 折叠组：尺寸/背景/边框/排版/布局/阴影） -->
      <ElFormItem v-if="styleEnabled" :label="styleSectionLabel">
        <ElCollapse class="property-panel__style-collapse">
          <!-- 尺寸 -->
          <ElCollapseItem title="尺寸" name="size">
            <div class="property-panel__style-grid">
              <ElInput :model-value="getStyleValue('width')" placeholder="width" size="small" @update:model-value="(v: string) => handleStyleInput('width', v)" />
              <ElInput :model-value="getStyleValue('height')" placeholder="height" size="small" @update:model-value="(v: string) => handleStyleInput('height', v)" />
              <ElInput :model-value="getStyleValue('marginTop')" placeholder="margin-top" size="small" @update:model-value="(v: string) => handleStyleInput('marginTop', v)" />
              <ElInput :model-value="getStyleValue('marginBottom')" placeholder="margin-bottom" size="small" @update:model-value="(v: string) => handleStyleInput('marginBottom', v)" />
              <ElInput :model-value="getStyleValue('paddingTop')" placeholder="padding-top" size="small" @update:model-value="(v: string) => handleStyleInput('paddingTop', v)" />
              <ElInput :model-value="getStyleValue('paddingBottom')" placeholder="padding-bottom" size="small" @update:model-value="(v: string) => handleStyleInput('paddingBottom', v)" />
            </div>
          </ElCollapseItem>

          <!-- 背景 -->
          <ElCollapseItem title="背景" name="bg">
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">背景色</span>
              <ElColorPicker :model-value="getStyleValue('backgroundColor')" size="small" @update:model-value="(v: string | null) => handleStyleInput('backgroundColor', v || '')" />
              <ElInput :model-value="getStyleValue('backgroundColor')" placeholder="#fff 或 rgb()" size="small" @update:model-value="(v: string) => handleStyleInput('backgroundColor', v)" />
            </div>
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">背景图</span>
              <ElInput :model-value="getStyleValue('backgroundImage')" placeholder="url(...)" size="small" @update:model-value="(v: string) => handleStyleInput('backgroundImage', v)" />
            </div>
          </ElCollapseItem>

          <!-- 边框 -->
          <ElCollapseItem title="边框" name="border">
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">颜色</span>
              <ElColorPicker :model-value="getStyleValue('borderColor')" size="small" @update:model-value="(v: string | null) => handleStyleInput('borderColor', v || '')" />
            </div>
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">宽度</span>
              <ElInput :model-value="getStyleValue('borderWidth')" placeholder="1px" size="small" @update:model-value="(v: string) => handleStyleInput('borderWidth', v)" />
              <span class="property-panel__style-label">圆角</span>
              <ElInput :model-value="getStyleValue('borderRadius')" placeholder="4px" size="small" @update:model-value="(v: string) => handleStyleInput('borderRadius', v)" />
            </div>
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">样式</span>
              <ElSelect :model-value="getStyleValue('borderStyle')" placeholder="solid" size="small" style="width: 100%" @update:model-value="(v: string) => handleStyleInput('borderStyle', v)">
                <ElOption label="无" value="" />
                <ElOption label="实线" value="solid" />
                <ElOption label="虚线" value="dashed" />
                <ElOption label="点线" value="dotted" />
              </ElSelect>
            </div>
          </ElCollapseItem>

          <!-- 排版 -->
          <ElCollapseItem title="排版" name="typo">
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">字号</span>
              <ElInput :model-value="getStyleValue('fontSize')" placeholder="14px" size="small" @update:model-value="(v: string) => handleStyleInput('fontSize', v)" />
              <span class="property-panel__style-label">行高</span>
              <ElInput :model-value="getStyleValue('lineHeight')" placeholder="1.5" size="small" @update:model-value="(v: string) => handleStyleInput('lineHeight', v)" />
            </div>
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">字重</span>
              <ElSelect :model-value="getStyleValue('fontWeight')" placeholder="normal" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('fontWeight', v)">
                <ElOption label="默认" value="" />
                <ElOption label="300 细" value="300" />
                <ElOption label="400 常规" value="400" />
                <ElOption label="500 中" value="500" />
                <ElOption label="600 粗" value="600" />
                <ElOption label="700 加粗" value="700" />
              </ElSelect>
              <span class="property-panel__style-label">对齐</span>
              <ElSelect :model-value="getStyleValue('textAlign')" placeholder="left" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('textAlign', v)">
                <ElOption label="左" value="left" />
                <ElOption label="中" value="center" />
                <ElOption label="右" value="right" />
              </ElSelect>
            </div>
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">颜色</span>
              <ElColorPicker :model-value="getStyleValue('color')" size="small" @update:model-value="(v: string | null) => handleStyleInput('color', v || '')" />
              <ElInput :model-value="getStyleValue('color')" placeholder="#333" size="small" @update:model-value="(v: string) => handleStyleInput('color', v)" />
            </div>
          </ElCollapseItem>

          <!-- 布局（flex） -->
          <ElCollapseItem title="布局" name="layout">
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">display</span>
              <ElSelect :model-value="getStyleValue('display')" placeholder="block" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('display', v)">
                <ElOption label="默认" value="" />
                <ElOption label="block" value="block" />
                <ElOption label="flex" value="flex" />
                <ElOption label="inline-block" value="inline-block" />
                <ElOption label="none" value="none" />
              </ElSelect>
              <span class="property-panel__style-label">gap</span>
              <ElInput :model-value="getStyleValue('gap')" placeholder="8px" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('gap', v)" />
            </div>
            <template v-if="getStyleValue('display') === 'flex'">
              <div class="property-panel__style-row">
                <span class="property-panel__style-label">方向</span>
                <ElSelect :model-value="getStyleValue('flexDirection')" placeholder="row" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('flexDirection', v)">
                  <ElOption label="row" value="row" />
                  <ElOption label="column" value="column" />
                </ElSelect>
                <span class="property-panel__style-label">换行</span>
                <ElSelect :model-value="getStyleValue('flexWrap')" placeholder="nowrap" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('flexWrap', v)">
                  <ElOption label="不换行" value="nowrap" />
                  <ElOption label="换行" value="wrap" />
                </ElSelect>
              </div>
              <div class="property-panel__style-row">
                <span class="property-panel__style-label">主轴</span>
                <ElSelect :model-value="getStyleValue('justifyContent')" placeholder="flex-start" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('justifyContent', v)">
                  <ElOption label="起始" value="flex-start" />
                  <ElOption label="居中" value="center" />
                  <ElOption label="末尾" value="flex-end" />
                  <ElOption label="两端" value="space-between" />
                  <ElOption label="均分" value="space-around" />
                </ElSelect>
                <span class="property-panel__style-label">交叉</span>
                <ElSelect :model-value="getStyleValue('alignItems')" placeholder="stretch" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('alignItems', v)">
                  <ElOption label="拉伸" value="stretch" />
                  <ElOption label="起始" value="flex-start" />
                  <ElOption label="居中" value="center" />
                  <ElOption label="末尾" value="flex-end" />
                </ElSelect>
              </div>
            </template>
          </ElCollapseItem>

          <!-- 阴影 -->
          <ElCollapseItem title="阴影" name="shadow">
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">预设</span>
              <ElSelect :model-value="getStyleValue('boxShadow')" placeholder="无" size="small" style="flex: 1" @update:model-value="(v: string) => handleStyleInput('boxShadow', v)">
                <ElOption v-for="s in SHADOW_PRESETS" :key="s.value" :label="s.label" :value="s.value" />
              </ElSelect>
            </div>
            <div class="property-panel__style-row">
              <span class="property-panel__style-label">自定义</span>
              <ElInput :model-value="getStyleValue('boxShadow')" placeholder="0 2px 8px rgba(0,0,0,0.1)" size="small" @update:model-value="(v: string) => handleStyleInput('boxShadow', v)" />
            </div>
          </ElCollapseItem>
        </ElCollapse>
      </ElFormItem>

      <!-- V2-T5 动画分区（FeatureGate 控制） -->
      <ElFormItem v-if="animationEnabled" label="动画">
        <div class="property-panel__animation">
          <div class="property-panel__anim-row">
            <span class="property-panel__anim-label">类型</span>
            <ElSelect
              :model-value="getAnimValue('type') as AnimationType | undefined"
              placeholder="无动画"
              size="small"
              style="flex: 1"
              clearable
              @update:model-value="(v: unknown) => v ? handleAnimInput('type', v) : clearAnimation()"
            >
              <ElOption v-for="opt in ANIMATION_TYPES" :key="opt.value" :label="opt.label" :value="opt.value" />
            </ElSelect>
          </div>
          <template v-if="getAnimValue('type')">
            <div class="property-panel__anim-row">
              <span class="property-panel__anim-label">触发</span>
              <ElSelect
                :model-value="(getAnimValue('trigger') as AnimationTrigger | undefined) ?? 'load'"
                size="small"
                style="flex: 1"
                @update:model-value="(v: string) => handleAnimInput('trigger', v)"
              >
                <ElOption v-for="opt in ANIMATION_TRIGGERS" :key="opt.value" :label="opt.label" :value="opt.value" />
              </ElSelect>
            </div>
            <div class="property-panel__anim-row">
              <span class="property-panel__anim-label">时长(ms)</span>
              <ElInputNumber
                :model-value="Number(getAnimValue('duration') ?? 600)"
                :min="0"
                :step="100"
                size="small"
                controls-position="right"
                style="flex: 1"
                @update:model-value="(v?: number) => handleAnimInput('duration', v ?? 600)"
              />
            </div>
            <div class="property-panel__anim-row">
              <span class="property-panel__anim-label">延迟(ms)</span>
              <ElInputNumber
                :model-value="Number(getAnimValue('delay') ?? 0)"
                :min="0"
                :step="100"
                size="small"
                controls-position="right"
                style="flex: 1"
                @update:model-value="(v?: number) => handleAnimInput('delay', v ?? 0)"
              />
            </div>
            <div class="property-panel__anim-row">
              <span class="property-panel__anim-label">缓动</span>
              <ElSelect
                :model-value="(getAnimValue('easing') as string | undefined) ?? 'ease-out'"
                size="small"
                style="flex: 1"
                @update:model-value="(v: string) => handleAnimInput('easing', v)"
              >
                <ElOption label="ease-out" value="ease-out" />
                <ElOption label="ease-in" value="ease-in" />
                <ElOption label="ease-in-out" value="ease-in-out" />
                <ElOption label="linear" value="linear" />
              </ElSelect>
            </div>
            <div v-if="getAnimValue('trigger') === 'in-view'" class="property-panel__anim-row">
              <span class="property-panel__anim-label">重复</span>
              <ElSwitch
                :model-value="Boolean(getAnimValue('scrollRepeat'))"
                @update:model-value="(v: string | number | boolean) => handleAnimInput('scrollRepeat', Boolean(v))"
              />
              <span class="property-panel__anim-hint">每次进入视口重播</span>
            </div>
          </template>
        </div>
      </ElFormItem>

      <!-- 事件分区：按 meta.events 配动作表达式（W1-T5） -->
      <ElFormItem v-if="eventNames.length" label="事件动作">
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

      <!-- 数据源分区：绑 datasource + varName（W1-T5 / D15-B1） -->
      <ElFormItem v-if="datasources.length || datasourceManageEnabled" label="数据源">
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
          <!-- D15-B1：管理数据源 + 测试连通按钮（FeatureGate 控制） -->
          <div v-if="datasourceManageEnabled || testConnectEnabled" class="property-panel__ds-actions">
            <ElButton
              v-if="datasourceManageEnabled"
              size="small"
              link
              @click="emit('open-datasource')"
            >
              管理数据源
            </ElButton>
            <ElButton
              v-if="testConnectEnabled && getCurrentDatasourceId()"
              size="small"
              link
              @click="emit('test-connect', getCurrentDatasourceId())"
            >
              测试连通
            </ElButton>
          </div>
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

  // === D15-E0 数组编辑器 ===
  &__array {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  &__array-row {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    padding: 6px;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    background: #fafafa;
  }

  &__array-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
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

  &__ds-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-start;
    margin-top: 2px;
  }

  // === D15-A3 样式分区 ===
  &__style-collapse {
    width: 100%;

    :deep(.el-collapse-item__header) {
      font-size: 13px;
      height: 32px;
      line-height: 32px;
    }
    :deep(.el-collapse-item__content) {
      padding-bottom: 8px;
    }
  }

  &__style-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: 100%;
  }

  &__style-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    width: 100%;
  }

  &__style-label {
    font-size: 12px;
    color: #606266;
    flex-shrink: 0;
    min-width: 36px;
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
}
</style>
