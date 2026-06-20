<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import Sortable from 'sortablejs';
import RuntimeRenderer from './RuntimeRenderer.vue';
import DesignRenderer from './DesignRenderer.vue';
import { getComponent } from './registry';
import type { PageSchema } from './schema';

const props = withDefaults(
  defineProps<{
    schema: PageSchema | null | undefined;
    showToolbar?: boolean;
    placeholder?: string;
    /** When true, use DesignRenderer (selectable nodes, empty placeholders, Sortable reorder) and emit select/add-node/reorder */
    designMode?: boolean;
  }>(),
  { showToolbar: true, placeholder: '从左侧拖拽组件到此处', designMode: false }
);

const emit = defineEmits<{
  'update:schema': [value: PageSchema | null | undefined];
  select: [nodeId: string | null];
  /** Emit when a node type is dropped from palette; parentId 未传表示追加到 root.children，否则追加到该 id 对应节点（如表单）的 children */
  'add-node': [type: string, parentId?: string];
  /** Emit when root.children are reordered (fromIndex, toIndex); parent may call reorderRootChildren */
  reorder: [fromIndex: number, toIndex: number];
  /** 跨容器拖拽：nodeId 从 fromParentId 移到 toParentId 的 toIndex（null=root 级） */
  'move-node': [nodeId: string, fromParentId: string | null, toParentId: string | null, toIndex: number];
}>();

const formState = computed(() => props.schema?.formState ?? {});
const formErrors = ref<Record<string, string>>({});
const selectedNodeId = ref<string | null>(null);
const sortableRef = ref<HTMLElement | null>(null);
let sortableInstance: Sortable | null = null;

watch(
  () => props.schema?.root?.id,
  () => {
    formErrors.value = {};
  }
);

function onSelect(nodeId: string | null): void {
  selectedNodeId.value = nodeId;
  emit('select', nodeId);
}

function onPaletteDragOver(e: DragEvent): void {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}

function onPaletteDrop(e: DragEvent): void {
  e.preventDefault();
  const raw = e.dataTransfer?.getData('application/json');
  if (!raw) return;
  try {
    const data = JSON.parse(raw) as { type?: string };
    if (data?.type) emit('add-node', data.type);
  } catch {
    // ignore
  }
}

function initSortable(): void {
  if (!sortableRef.value || !props.schema?.root?.children?.length) return;
  sortableInstance?.destroy();
  sortableRef.value.dataset.parentId = ''; // root 级标识
  sortableInstance = Sortable.create(sortableRef.value, {
    animation: 150,
    group: 'luban-nodes',
    // FINDING-1: locked nodes can't be dragged out (plan §4.2).
    filter: '.design-renderer__wrapper--locked',
    preventOnFilter: false,
    onEnd(ev) {
      const oldIndex = ev.oldIndex;
      const newIndex = ev.newIndex;
      if (oldIndex == null || newIndex == null) return;
      const fromParent = (ev.from as HTMLElement).dataset.parentId ?? '';
      const toParent = (ev.to as HTMLElement).dataset.parentId ?? '';
      const nodeId = (ev.item as HTMLElement).dataset.nodeId ?? '';
      // revert DOM：跨容器时还原 Sortable 的 DOM 移动，交由 Vue 按 schema 重渲染
      if (ev.from !== ev.to && ev.item.parentNode === ev.to) {
        ev.from.insertBefore(ev.item, ev.from.children[oldIndex] ?? null);
      }
      if (!nodeId) return;
      if (fromParent === toParent) {
        emit('reorder', oldIndex, newIndex);
      } else {
        emit('move-node', nodeId, fromParent || null, toParent || null, newIndex);
      }
    },
  });
}

onMounted(() => {
  initSortable();
});

watch(
  () => props.schema?.root?.children?.length,
  () => {
    nextTick(() => initSortable());
  }
);
</script>

<template>
  <div class="luban-designer">
    <slot v-if="showToolbar" name="toolbar" />
    <div
      v-if="schema?.root"
      class="luban-designer__canvas"
      :class="{ 'luban-designer__canvas--design': designMode }"
      @dragover="designMode ? onPaletteDragOver : undefined"
      @drop="designMode ? onPaletteDrop : undefined"
    >
      <template v-if="designMode">
        <component
          :is="getComponent(schema.root.type)"
          v-bind="(schema.root.props ?? {}) as Record<string, unknown>"
          class="luban-designer__root-container"
        >
          <div
            v-if="(schema.root.children ?? []).length"
            ref="sortableRef"
            class="luban-designer__sortable-list"
          >
            <div
              v-for="child in schema.root.children"
              :key="child.id"
              class="luban-designer__sortable-item"
              :data-node-id="child.id"
            >
              <DesignRenderer
                :root="child"
                :form-state="formState"
                :form-errors="formErrors"
                :selected-node-id="selectedNodeId"
                :placeholder-text="placeholder"
                @select="onSelect"
                @add-node="(type, parentId) => emit('add-node', type, parentId)"
                @move-node="(nodeId, from, to, idx) => emit('move-node', nodeId, from, to, idx)"
              />
            </div>
          </div>
          <div
            v-else
            class="luban-designer__placeholder"
            @dragover.prevent="onPaletteDragOver"
            @drop="onPaletteDrop"
          >
            {{ placeholder }}
          </div>
        </component>
        <div
          class="luban-designer__canvas-spacer"
          @dragover.prevent="onPaletteDragOver"
          @drop="onPaletteDrop"
        />
      </template>
      <RuntimeRenderer
        v-else
        :root="schema.root"
        :form-state="formState"
        :form-errors="formErrors"
      />
    </div>
    <div v-else class="luban-designer__placeholder">
      {{ placeholder }}
    </div>
  </div>
</template>

<style scoped>
.luban-designer__canvas--design {
  min-height: 200px;
}
.luban-designer__root-container {
  width: 100%;
}
.luban-designer__sortable-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.luban-designer__sortable-item {
  min-height: 24px;
}
.luban-designer__placeholder {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  border: 1px dashed #ccc;
  border-radius: 4px;
}
.luban-designer__canvas-spacer {
  min-height: 160px;
}
</style>
