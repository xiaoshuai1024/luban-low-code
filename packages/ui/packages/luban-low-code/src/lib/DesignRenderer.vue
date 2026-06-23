<script setup lang="ts">
import { getComponent } from './registry';
import type { NodeSchema, ResponsiveBreakpoint } from './schema';
import { isContainerType } from './constants';
import { validate, type ValidationRule } from './validation';
import { resolveResponsiveProps } from './responsive';
import Sortable from 'sortablejs';
import { onMounted, onBeforeUnmount, ref as vueRef, computed, watch, nextTick } from 'vue';
import DesignRendererSelf from './DesignRenderer.vue';

const FORM_VALUE_TYPES = new Set([
  'LubanInput',
  'LubanTextArea',
  'LubanSelect',
  'LubanCheckbox',
  'LubanRadioGroup',
  'LubanSwitch',
]);

const props = withDefaults(
  defineProps<{
    root: NodeSchema;
    formState: Record<string, unknown>;
    formErrors?: Record<string, string>;
    selectedNodeId: string | null;
    placeholderText?: string;
    /** V2-T4 设计态当前断点：按断点取 resolveResponsiveProps 渲染对应 style */
    breakpoint?: ResponsiveBreakpoint;
  }>(),
  { formErrors: () => ({}), placeholderText: '拖拽组件到此处', breakpoint: 'desktop' }
);

const emit = defineEmits<{
  select: [nodeId: string | null];
  /** 从面板拖入到当前容器时发出；parentId 为当前节点 id */
  'add-node': [type: string, parentId: string];
  /** 跨容器拖拽冒泡（来自子容器 Sortable onEnd） */
  'move-node': [nodeId: string, fromParentId: string | null, toParentId: string | null, toIndex: number];
}>();

function onWrapperClick(e: Event, nodeId: string): void {
  e.stopPropagation();
  emit('select', nodeId);
}

function onPlaceholderClick(e: Event): void {
  e.stopPropagation();
  emit('select', props.root.id);
}

/**
 * V2-T4：按当前断点折叠节点 style。
 * desktop = node.style；tablet/mobile 浅合并覆盖。
 * 设计态直接用内联 :style 渲染对应断点（无需 @media）。
 *
 * V2-UX：当 node.position === 'absolute' 时，合并 layout 坐标到 style
 * （position:absolute + left/top/width/height），实现自由画布定位。
 */
const resolvedStyle = computed<Record<string, string>>(() => {
  const base = resolveResponsiveProps(props.root, props.breakpoint);
  if (props.root.position === 'absolute') {
    const l = props.root.layout ?? {};
    return {
      ...base,
      position: 'absolute',
      ...(l.x != null ? { left: `${l.x}px` } : {}),
      ...(l.y != null ? { top: `${l.y}px` } : {}),
      ...(l.width != null ? { width: `${l.width}px` } : {}),
      ...(l.height != null ? { height: `${l.height}px` } : {}),
    };
  }
  return base;
});

/**
 * V2-UX：绝对定位节点的拖拽移动。
 * mousedown 在选中态的 absolute 节点上 → mousemove 实时更新 layout.x/y → mouseup emit。
 * 仅设计态生效；流式节点不响应（靠 Sortable 重排）。
 */
function onAbsDragStart(e: MouseEvent): void {
  if (props.root.position !== 'absolute') return;
  // 仅在选中态才允许拖拽移动（避免误触）
  if (props.selectedNodeId !== props.root.id) return;
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const origX = props.root.layout?.x ?? 0;
  const origY = props.root.layout?.y ?? 0;
  if (!props.root.layout) props.root.layout = {};

  function onMove(ev: MouseEvent): void {
    props.root.layout!.x = Math.round(origX + (ev.clientX - startX));
    props.root.layout!.y = Math.round(origY + (ev.clientY - startY));
  }
  function onUp(): void {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

const isEmptyContainer = (): boolean =>
  isContainerType(props.root.type) &&
  (props.root.children?.length ?? 0) === 0;

function getFormValue(name: string | undefined): unknown {
  if (name == null) return undefined;
  return props.formState[name];
}

function setFormValue(name: string | undefined, value: unknown): void {
  if (name == null) return;
  const state = props.formState as Record<string, unknown>;
  if (name in state) {
    state[name] = value;
    const rules = props.root.props?.rules as ValidationRule[] | undefined;
    const message = validate(value, rules);
    if (message) {
      (props.formErrors as Record<string, string>)[name] = message;
    } else {
      delete (props.formErrors as Record<string, string>)[name];
    }
  }
}

function isFormValueType(type: string): boolean {
  return FORM_VALUE_TYPES.has(type);
}

function getFieldError(name: string | undefined): string | undefined {
  if (name == null) return undefined;
  return props.formErrors[name];
}

function validateField(name: string | undefined): void {
  if (name == null) return;
  const value = getFormValue(name);
  const rules = props.root.props?.rules as ValidationRule[] | undefined;
  const message = validate(value, rules);
  const err = props.formErrors as Record<string, string>;
  if (message) err[name] = message;
  else delete err[name];
}

function formValueProps(
  nodeProps: Record<string, unknown> | undefined,
  name: string | undefined
): Record<string, unknown> {
  if (nodeProps == null) return {};
  const { content: _c, text: _t, rules: _r, ...rest } = nodeProps;
  const errorMessage = getFieldError(name);
  return {
    ...rest,
    error: !!errorMessage,
    errorMessage: errorMessage ?? undefined,
  };
}

function componentProps(
  nodeProps: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (nodeProps == null) return {};
  const { content: _c, text: _t, rules: _r, ...rest } = nodeProps;
  return rest;
}

function slotContent(): string {
  const p = props.root.props;
  if (p?.content != null) return String(p.content);
  if (p?.text != null) return String(p.text);
  return '';
}

function onContainerDragOver(e: DragEvent): void {
  if (props.root.locked) return; // locked 容器不接受拖入
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}

function onContainerDrop(e: DragEvent): void {
  if (props.root.locked) return; // locked 容器不接受 drop
  e.preventDefault();
  e.stopPropagation();
  const raw = e.dataTransfer?.getData('application/json');
  if (!raw) return;
  try {
    const data = JSON.parse(raw) as { type?: string };
    if (data?.type) emit('add-node', data.type, props.root.id);
  } catch {
    // ignore
  }
}

// === 容器内 Sortable（group: luban-nodes，支持跨容器拖拽） ===
const containerDropRef = vueRef<HTMLElement | null>(null);
let containerSortable: Sortable | null = null;

function handleContainerSortEnd(ev: Sortable.SortableEvent): void {
  const oldIndex = ev.oldIndex;
  const newIndex = ev.newIndex;
  if (oldIndex == null || newIndex == null) return;
  const fromParent = (ev.from as HTMLElement).dataset.parentId ?? '';
  const toParent = (ev.to as HTMLElement).dataset.parentId ?? '';
  const nodeId = (ev.item as HTMLElement).dataset.nodeId ?? '';
  // revert DOM：跨容器时还原，交由 Vue 按 schema 重渲染
  if (ev.from !== ev.to && ev.item.parentNode === ev.to) {
    ev.from.insertBefore(ev.item, ev.from.children[oldIndex] ?? null);
  }
  if (!nodeId) return;
  emit('move-node', nodeId, fromParent || null, toParent || null, newIndex);
}

/**
 * 初始化/重建容器 Sortable。
 * 关键修复（W1-T1）：容器最初可能为空（containerDropRef 不渲染），
 * 当子节点添加后 DOM 才出现 → 必须在 children 变化时重新初始化 Sortable，
 * 否则拖拽功能失效（"拖动不生效"根因）。
 */
function reinitContainerSortable(): void {
  containerSortable?.destroy();
  containerSortable = null;
  if (containerDropRef.value) {
    containerDropRef.value.dataset.parentId = props.root.id;
    containerSortable = Sortable.create(containerDropRef.value, {
      animation: 150,
      group: 'luban-nodes',
      filter: '.design-renderer__wrapper--locked',
      preventOnFilter: false,
      onEnd: handleContainerSortEnd,
    });
  }
}

onMounted(() => {
  reinitContainerSortable();
});

/**
 * W1-T1 关键修复：监听 children 数量变化，当容器从空→有子节点时
 * containerDropRef 首次渲染，需 nextTick 后重新初始化 Sortable。
 * 反之从有→空时销毁旧实例避免泄漏。
 */
watch(
  () => props.root.children?.length ?? 0,
  () => {
    nextTick(() => reinitContainerSortable());
  }
);

onBeforeUnmount(() => {
  containerSortable?.destroy();
  containerSortable = null;
});
</script>

<template>
  <template v-if="root">
    <div
      class="design-renderer__wrapper"
      :data-node-id="root.id"
      :data-lb-node="root.id"
      :class="[
        {
          'design-renderer__wrapper--selected': selectedNodeId === root.id,
          'design-renderer__wrapper--locked': root.locked,
          'design-renderer__wrapper--hidden': root.hidden,
        },
        root.className,
      ]"
      :style="resolvedStyle"
      @click="onWrapperClick($event, root.id)"
      @mousedown="onAbsDragStart"
    >
      <template v-if="isEmptyContainer()">
        <div
          class="design-renderer__placeholder"
          @click="onPlaceholderClick"
          @dragover.prevent="onContainerDragOver"
          @drop="onContainerDrop"
        >
          {{ placeholderText }}
        </div>
      </template>
      <template v-else>
        <!-- Form value components -->
        <component
          v-if="getComponent(root.type) && isFormValueType(root.type)"
          :is="getComponent(root.type)"
          v-bind="
            formValueProps(
              root.props as Record<string, unknown>,
              root.props?.name as string
            )
          "
          :model-value="
            root.props?.name != null
              ? getFormValue(root.props.name as string)
              : undefined
          "
          @update:model-value="
            root.props?.name != null
              ? setFormValue(root.props.name as string, $event)
              : () => {}
          "
          @blur="validateField(root.props?.name as string)"
        >
          <DesignRendererSelf
            v-for="child in (root.children ?? [])"
            :key="child.id"
            :root="child"
            :form-state="formState"
            :form-errors="formErrors"
            :selected-node-id="selectedNodeId"
            :placeholder-text="placeholderText"
            :breakpoint="breakpoint"
            @select="emit('select', $event)"
            @add-node="emit('add-node', $event[0], $event[1])"
          />
        </component>
        <!-- Non-form components: props + slot from content or DesignRenderer children -->
        <component
          v-else-if="getComponent(root.type)"
          :is="getComponent(root.type)"
          v-bind="componentProps(root.props as Record<string, unknown>)"
        >
          <template v-if="(root.children ?? []).length">
            <div
              ref="containerDropRef"
              class="design-renderer__container-drop"
              @dragover.prevent="onContainerDragOver"
              @drop="onContainerDrop"
            >
              <DesignRendererSelf
                v-for="child in (root.children ?? [])"
                :key="child.id"
                :root="child"
                :form-state="formState"
                :form-errors="formErrors"
                :selected-node-id="selectedNodeId"
                :placeholder-text="placeholderText"
                :breakpoint="breakpoint"
                @select="emit('select', $event)"
                @add-node="emit('add-node', $event[0], $event[1])"
                @move-node="(nodeId, from, to, idx) => emit('move-node', nodeId, from, to, idx)"
              />
            </div>
          </template>
          <template v-else-if="slotContent()">{{ slotContent() }}</template>
        </component>
        <template v-else>
          <DesignRendererSelf
            v-for="child in (root.children ?? [])"
            :key="child.id"
            :root="child"
            :form-state="formState"
            :form-errors="formErrors"
            :selected-node-id="selectedNodeId"
            :placeholder-text="placeholderText"
            :breakpoint="breakpoint"
            @select="emit('select', $event)"
            @add-node="emit('add-node', $event[0], $event[1])"
          />
        </template>
      </template>
    </div>
  </template>
</template>

<style scoped>
.design-renderer__wrapper {
  position: relative;
  min-height: 24px;
  outline: 1px solid transparent;
  outline-offset: -1px;
  border-radius: 4px;
  transition: outline-color 0.15s ease;
}
.design-renderer__wrapper:hover {
  outline-color: color-mix(in srgb, var(--lb-primary, #1976d2) 35%, transparent);
}
.design-renderer__wrapper--selected {
  outline: 2px solid var(--lb-primary, #1e88e5);
  outline-offset: 0;
}
.design-renderer__wrapper--locked {
  outline: 2px dashed var(--lb-text-muted, #9ca3af);
  cursor: not-allowed;
}
.design-renderer__wrapper--hidden {
  opacity: 0.4;
}
.design-renderer__placeholder {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lb-text-muted, #9ca3af);
  font-size: 13px;
  border: 2px dashed rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  margin: 4px 0;
}
.design-renderer__container-drop {
  min-height: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
