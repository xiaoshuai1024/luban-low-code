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
} from 'element-plus'
import type { NodeSchema } from '@/types/schema'
import type { ComponentMeta, PropSchemaItem } from 'luban-low-code'

interface Props {
  node: NodeSchema | null
  meta: ComponentMeta | null
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  node: null,
  meta: null,
  readonly: false,
})

const emit = defineEmits<{
  (e: 'update:prop', nodeId: string, key: string, value: unknown): void
  (e: 'delete', nodeId: string): void
  (e: 'duplicate', nodeId: string): void
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

function handleDelete(): void {
  if (!props.node) return
  emit('delete', props.node.id)
}

function handleDuplicate(): void {
  if (!props.node) return
  emit('duplicate', props.node.id)
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

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;
  }
}
</style>
