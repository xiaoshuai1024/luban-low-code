<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import Sortable from 'sortablejs';
import RuntimeRenderer from './RuntimeRenderer.vue';
import DesignRenderer from './DesignRenderer.vue';
import { getComponent } from './registry';
import type { PageSchema, ResponsiveBreakpoint } from './schema';
import { computeAlignGuides, collectNodeRects, dedupeGuides, computeSpacingHints, type GuideLine, type SpacingHint } from './alignGuides';

/**
 * V2-T12 拖拽对齐辅助线。
 * hover 节点时计算与其他节点的边缘/中线对齐，显示辅助线 overlay。
 * alignGuidesEnabled 运行时可关（默认开）。
 */
const alignGuidesEnabled = ref(true);
const activeGuides = ref<GuideLine[]>([]);
/** V2-T12 间距提示 */
const activeSpacingHints = ref<SpacingHint[]>([]);
/** V2-T11 框选：拖框矩形 {start, end}（画布坐标） */
const frameSelect = ref<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
const canvasRef = ref<HTMLElement | null>(null);
/** 视口 ref：缩放后的内容容器，对齐/框选以此 ref 计算坐标 */
const viewportRef = ref<HTMLElement | null>(null);

// === 拖放入画布视觉反馈 ===
const dropZoneActive = ref(false);
let dropZoneCounter = 0;

function onCanvasDragEnter(e: DragEvent): void {
  if (!props.designMode) return;
  e.preventDefault();
  dropZoneCounter++;
  dropZoneActive.value = true;
}

function onCanvasDragLeave(e: DragEvent): void {
  dropZoneCounter--;
  if (dropZoneCounter <= 0) {
    dropZoneCounter = 0;
    dropZoneActive.value = false;
  }
}

function onCanvasDropClear(): void {
  dropZoneCounter = 0;
  dropZoneActive.value = false;
  clearInsertIndicator();
  dropError.value = null;
  clearDropPreview();
}

// === 缩放与平移 ===
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const panStartX = ref(0);
const panStartY = ref(0);
const panStartPanX = ref(0);
const panStartPanY = ref(0);
const spaceHeld = ref(false);

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const GRID_SIZE = 8; // 8px 网格

const viewportStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: 'top left',
  transition: isPanning.value ? 'none' : 'transform 0.15s ease',
}));

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));
}

function onCanvasWheel(e: WheelEvent): void {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  const newZoom = clampZoom(zoom.value + delta);
  // 以鼠标位置为中心缩放
  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ratio = newZoom / zoom.value;
    panX.value = mx - ratio * (mx - panX.value);
    panY.value = my - ratio * (my - panY.value);
  }
  zoom.value = newZoom;
}

function onCanvasKeyDown(e: KeyboardEvent): void {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    spaceHeld.value = true;
  }
}

function onCanvasKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') {
    spaceHeld.value = false;
    isPanning.value = false;
  }
}

function onCanvasPanStart(e: MouseEvent): void {
  if (!spaceHeld.value || !props.designMode) return;
  // 点在节点上时不启动平移（让 SortableJS 处理）
  const target = (e.target as HTMLElement)?.closest('[data-lb-node]');
  if (target) return;
  isPanning.value = true;
  panStartX.value = e.clientX;
  panStartY.value = e.clientY;
  panStartPanX.value = panX.value;
  panStartPanY.value = panY.value;
}

function onCanvasPanMove(e: MouseEvent): void {
  if (!isPanning.value) return;
  panX.value = panStartPanX.value + (e.clientX - panStartX.value);
  panY.value = panStartPanY.value + (e.clientY - panStartY.value);
}

function onCanvasPanEnd(): void {
  isPanning.value = false;
}

function onZoomIn(): void {
  zoom.value = clampZoom(zoom.value + ZOOM_STEP);
}

function onZoomOut(): void {
  zoom.value = clampZoom(zoom.value - ZOOM_STEP);
}

function onZoomReset(): void {
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
}

function onZoomFit(): void {
  if (!canvasRef.value || !viewportRef.value) return;
  const containerRect = canvasRef.value.getBoundingClientRect();
  const contentEl = viewportRef.value.firstElementChild as HTMLElement | null;
  if (!contentEl) return;
  const contentRect = contentEl.getBoundingClientRect();
  const naturalW = contentRect.width / zoom.value;
  const naturalH = contentRect.height / zoom.value;
  const padding = 40;
  const scaleX = (containerRect.width - padding * 2) / naturalW;
  const scaleY = (containerRect.height - padding * 2) / naturalH;
  const fitZoom = clampZoom(Math.min(scaleX, scaleY, 1));
  zoom.value = fitZoom;
  panX.value = (containerRect.width - naturalW * fitZoom) / 2;
  panY.value = (containerRect.height - naturalH * fitZoom) / 2;
}

// === 网格显示 & 吸附 ===
const showGrid = ref(true);
const snapToGrid = ref(false);

function snapValue(v: number): number {
  if (!snapToGrid.value) return v;
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function toggleGrid(): void { showGrid.value = !showGrid.value; }
function toggleSnap(): void { snapToGrid.value = !snapToGrid.value; }

/** hover 节点时显示对齐辅助线 + 间距提示（dragging 节点 = hovered） */
function onCanvasMouseMove(e: MouseEvent): void {
  if (!alignGuidesEnabled.value || !canvasRef.value) {
    activeGuides.value = [];
    activeSpacingHints.value = [];
    return;
  }
  const target = (e.target as HTMLElement)?.closest('[data-lb-node]') as HTMLElement | null;
  if (!target) {
    activeGuides.value = [];
    activeSpacingHints.value = [];
    return;
  }
  const draggingId = target.dataset.lbNode;
  if (!draggingId) {
    activeGuides.value = [];
    activeSpacingHints.value = [];
    return;
  }
  const others = collectNodeRects(canvasRef.value ?? viewportRef.value, draggingId);
  if (others.length === 0) {
    activeGuides.value = [];
    activeSpacingHints.value = [];
    return;
  }
  // 使用 canvasRef 做坐标参考（稳定，不受 viewport transform 影响）
  const containerRect = (canvasRef.value ?? viewportRef.value)!.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const draggingRect = {
    id: draggingId,
    left: r.left - containerRect.left,
    top: r.top - containerRect.top,
    width: r.width,
    height: r.height,
  };
  const result = computeAlignGuides(draggingRect, others);
  activeGuides.value = dedupeGuides(result.guides);
  activeSpacingHints.value = result.spacingHints;
}

/** V2-T11 框选：mousedown 空白处开始拖框 */
function onCanvasMouseDown(e: MouseEvent): void {
  if (!props.designMode) return;
  // Space 平移优先
  if (spaceHeld.value) {
    onCanvasPanStart(e);
    return;
  }
  const target = (e.target as HTMLElement)?.closest('[data-lb-node]');
  if (target) return; // 点在节点上，不框选
  if (!canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  frameSelect.value = {
    startX: e.clientX - rect.left,
    startY: e.clientY - rect.top,
    endX: e.clientX - rect.left,
    endY: e.clientY - rect.top,
  };
}

/** 框选拖动中：更新框矩形 */
function onCanvasDragMove(e: MouseEvent): void {
  if (!frameSelect.value || !canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  frameSelect.value.endX = e.clientX - rect.left;
  frameSelect.value.endY = e.clientY - rect.top;
}

/** 框选结束：收集框内节点 id，emit multi-select */
function onCanvasMouseUp(): void {
  if (!frameSelect.value) return;
  const { startX, startY, endX, endY } = frameSelect.value;
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);
  frameSelect.value = null;
  if (maxX - minX < 5 && maxY - minY < 5) return;
  if (!canvasRef.value) return;
  const containerRect = canvasRef.value.getBoundingClientRect();
  const allRects = collectNodeRects(canvasRef.value, null);
  const selected: string[] = [];
  for (const r of allRects) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      selected.push(r.id);
    }
  }
  if (selected.length > 0) {
    emit('multi-select', selected);
  }
  void containerRect;
}

function clearGuides(): void {
  activeGuides.value = [];
  activeSpacingHints.value = [];
}

onBeforeUnmount(clearGuides);

// 全局键盘监听（space 平移）
function onGlobalKeyDown(e: KeyboardEvent): void {
  onCanvasKeyDown(e);
}
function onGlobalKeyUp(e: KeyboardEvent): void {
  onCanvasKeyUp(e);
}
onMounted(() => {
  document.addEventListener('keydown', onGlobalKeyDown);
  document.addEventListener('keyup', onGlobalKeyUp);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeyDown);
  document.removeEventListener('keyup', onGlobalKeyUp);
});

const props = withDefaults(
  defineProps<{
    schema: PageSchema | null | undefined;
    showToolbar?: boolean;
    placeholder?: string;
    /** When true, use DesignRenderer (selectable nodes, empty placeholders, Sortable reorder) and emit select/add-node/reorder */
    designMode?: boolean;
    /** V2-T4 设计态当前断点：透传给 DesignRenderer 渲染对应断点 style */
    breakpoint?: ResponsiveBreakpoint;
  }>(),
  { showToolbar: true, placeholder: '从左侧拖拽组件到此处', designMode: false, breakpoint: 'desktop' }
);

const emit = defineEmits<{
  'update:schema': [value: PageSchema | null | undefined];
  select: [nodeId: string | null];
  /** V2-T11 框选多选：emit 框内所有节点 id */
  'multi-select': [nodeIds: string[]];
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

/** 插入指示位置（palette 拖入时显示目标位置的蓝线） */
const insertIndicatorY = ref<number | null>(null);
const insertIndicatorParent = ref<'root' | string | null>(null);

function onPaletteDragOver(e: DragEvent): void {
  // .prevent 修饰符已调用 preventDefault()；此处只需设 dropEffect
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  updateDropPreview(e);
  // 计算插入指示线位置（仅在 designMode 时有意义）
  if (!props.designMode) return;
  const refEl = canvasRef.value ?? viewportRef.value;
  if (!refEl) return;
  const refRect = refEl.getBoundingClientRect();
  const mouseY = e.clientY - refRect.top;
  // 查找最近的 sortable 元素间隙
  const items = refEl.querySelectorAll('.luban-designer__sortable-item');
  let closestY: number | null = null;
  let closestIdx = -1;
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    const centerY = rect.top - refRect.top + rect.height / 2;
    if (closestY === null || Math.abs(mouseY - centerY) < Math.abs(mouseY - closestY)) {
      closestY = centerY;
      closestIdx = i;
    }
  }
  if (closestIdx >= 0 && items[closestIdx]) {
    const rect = items[closestIdx].getBoundingClientRect();
    const itemCenter = rect.top - refRect.top + rect.height / 2;
    if (mouseY < itemCenter) {
      // 插入在 closestIdx 之前
      insertIndicatorY.value = rect.top - refRect.top;
    } else {
      // 插入在 closestIdx 之后
      insertIndicatorY.value = rect.bottom - refRect.top;
    }
    insertIndicatorParent.value = 'root';
  } else if (items.length === 0) {
    insertIndicatorY.value = 20; // 空列表顶部
    insertIndicatorParent.value = 'root';
  }
}

function clearInsertIndicator(): void {
  insertIndicatorY.value = null;
  insertIndicatorParent.value = null;
}

/** 拖放失败提示 */
const dropError = ref<string | null>(null);

function onPaletteDrop(e: DragEvent): void {
  if (!props.designMode) return;
  e.preventDefault();
  e.stopPropagation(); // 防止冒泡到父元素重复 emit add-node
  onCanvasDropClear();
  const raw = e.dataTransfer?.getData('application/json');
  if (!raw) {
    dropError.value = '未检测到组件数据，请从左侧面板拖拽';
    return;
  }
  try {
    const data = JSON.parse(raw) as { type?: string };
    if (data?.type) {
      dropError.value = null;
      emit('add-node', data.type);
    } else {
      dropError.value = '拖入数据缺少组件类型';
    }
  } catch {
    dropError.value = '拖入数据格式错误';
  }
}

function clearDropError(): void {
  dropError.value = null;
}

/** 拖入预览：鼠标附近显示组件类型名 */
const dropPreviewType = ref<string | null>(null);
const dropPreviewX = ref(0);
const dropPreviewY = ref(0);

function updateDropPreview(e: DragEvent): void {
  if (!canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  dropPreviewX.value = e.clientX - rect.left + 16;
  dropPreviewY.value = e.clientY - rect.top - 20;
  try {
    const raw = e.dataTransfer?.getData('application/json');
    if (raw) {
      const data = JSON.parse(raw) as { type?: string };
      dropPreviewType.value = data?.type ?? null;
    }
  } catch {
    dropPreviewType.value = null;
  }
}

function clearDropPreview(): void {
  dropPreviewType.value = null;
}

function initSortable(): void {
  if (!sortableRef.value || !props.schema?.root?.children?.length) return;
  sortableInstance?.destroy();
  sortableRef.value.dataset.parentId = ''; // root 级标识
  sortableInstance = Sortable.create(sortableRef.value, {
    animation: 150,
    group: 'luban-nodes',
    filter: '.design-renderer__wrapper--locked',
    preventOnFilter: false,
    onEnd(ev) {
      const oldIndex = ev.oldIndex;
      const newIndex = ev.newIndex;
      if (oldIndex == null || newIndex == null) return;
      const fromParent = (ev.from as HTMLElement).dataset.parentId ?? '';
      const toParent = (ev.to as HTMLElement).dataset.parentId ?? '';
      const nodeId = (ev.item as HTMLElement).dataset.nodeId ?? '';
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
    <!-- 设计态内置工具栏：缩放控件 + 网格/吸附开关 -->
    <div v-if="designMode" class="luban-designer__builtin-toolbar">
      <div class="luban-designer__zoom-controls">
        <button
          class="luban-designer__zoom-btn"
          title="缩小 (Ctrl+滚轮)"
          :disabled="zoom <= ZOOM_MIN"
          @click="onZoomOut"
        >−</button>
        <span class="luban-designer__zoom-label" @click="onZoomReset" title="重置缩放">
          {{ Math.round(zoom * 100) }}%
        </span>
        <button
          class="luban-designer__zoom-btn"
          title="放大 (Ctrl+滚轮)"
          :disabled="zoom >= ZOOM_MAX"
          @click="onZoomIn"
        >+</button>
        <button
          class="luban-designer__zoom-btn luban-designer__zoom-btn--fit"
          title="适应画布"
          @click="onZoomFit"
        >⊡</button>
      </div>
      <div class="luban-designer__toggles">
        <button
          class="luban-designer__toggle-btn"
          :class="{ 'luban-designer__toggle-btn--active': showGrid }"
          title="显示网格"
          @click="toggleGrid"
        >⊞</button>
        <button
          class="luban-designer__toggle-btn"
          :class="{ 'luban-designer__toggle-btn--active': snapToGrid }"
          title="吸附网格"
          @click="toggleSnap"
        >⊟</button>
      </div>
    </div>

    <div
      v-if="schema?.root"
      ref="canvasRef"
      class="luban-designer__canvas"
      :class="{
        'luban-designer__canvas--design': designMode,
        'luban-designer__canvas--drop-active': dropZoneActive,
        'luban-designer__canvas--grid': showGrid && designMode,
      }"
      @dragover.prevent="onPaletteDragOver"
      @dragenter="onCanvasDragEnter"
      @dragleave="onCanvasDragLeave"
      @drop="onPaletteDrop"
      @wheel="designMode ? onCanvasWheel : undefined"
      @mousemove="(designMode ? onCanvasMouseMove : undefined); frameSelect ? onCanvasDragMove($event) : undefined; isPanning ? onCanvasPanMove($event) : undefined"
      @mouseleave="clearGuides"
      @mousedown="designMode ? onCanvasMouseDown : undefined"
      @mouseup="frameSelect ? onCanvasMouseUp() : undefined; isPanning ? onCanvasPanEnd() : undefined"
      :style="spaceHeld && designMode ? { cursor: isPanning ? 'grabbing' : 'grab' } : undefined"
    >
      <template v-if="designMode">
        <div ref="viewportRef" class="luban-designer__viewport" :style="viewportStyle" @dragover.prevent="onPaletteDragOver" @drop="onPaletteDrop">
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
                  :breakpoint="breakpoint"
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
            :class="{ 'luban-designer__canvas-spacer--active': dropZoneActive }"
            @dragover.prevent="onPaletteDragOver"
            @drop="onPaletteDrop"
          />

          <!-- 插入位置指示线 -->
          <div
            v-if="insertIndicatorY !== null"
            class="luban-designer__insert-line"
            :style="{ top: insertIndicatorY + 'px' }"
          />

          <!-- V2-T12 对齐辅助线 overlay -->
          <div v-if="activeGuides.length" class="luban-designer__guides" aria-hidden="true">
            <template v-for="(g, i) in activeGuides" :key="i">
              <div
                v-if="g.orientation === 'vertical'"
                class="luban-designer__guide luban-designer__guide--vertical"
                :style="{ left: g.position + 'px', top: g.start + 'px', height: (g.end - g.start) + 'px' }"
              />
              <div
                v-else
                class="luban-designer__guide luban-designer__guide--horizontal"
                :style="{ top: g.position + 'px', left: g.start + 'px', width: (g.end - g.start) + 'px' }"
              />
            </template>
          </div>
          <!-- V2-T12 间距提示 overlay -->
          <div v-if="activeSpacingHints.length" class="luban-designer__spacing" aria-hidden="true">
            <div
              v-for="(h, i) in activeSpacingHints"
              :key="'sp'+i"
              class="luban-designer__spacing-label"
              :style="{ left: h.cx + 'px', top: h.cy + 'px' }"
            >{{ h.distance }}</div>
          </div>
          <!-- V2-T11 框选矩形 overlay -->
          <div
            v-if="frameSelect"
            class="luban-designer__frame-box"
            :style="{
              left: Math.min(frameSelect.startX, frameSelect.endX) + 'px',
              top: Math.min(frameSelect.startY, frameSelect.endY) + 'px',
              width: Math.abs(frameSelect.endX - frameSelect.startX) + 'px',
              height: Math.abs(frameSelect.endY - frameSelect.startY) + 'px'
            }"
          />
        </div>

        <!-- 拖放预览 ghost -->
        <div
          v-if="dropPreviewType"
          class="luban-designer__drop-preview"
          :style="{ left: dropPreviewX + 'px', top: dropPreviewY + 'px' }"
        >
          + {{ dropPreviewType }}
        </div>
        <!-- 画布拖入提示浮层 -->
        <div v-if="dropZoneActive" class="luban-designer__drop-hint">
          <span class="luban-designer__drop-hint-icon">⬇</span>
          <span>释放以添加组件</span>
        </div>
        <!-- 拖放失败错误提示 -->
        <div v-if="dropError" class="luban-designer__drop-error">
          ⚠️ {{ dropError }}
        </div>
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
/* === 设计器根容器 === */
.luban-designer {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* === 画布 === */
.luban-designer__canvas {
  position: relative;
  flex: 1;
  min-height: 200px;
  overflow: hidden;
  background-color: #f0f2f5;
  transition: background-color 0.2s;
}

.luban-designer__canvas--design {
  cursor: default;
}

/* 点阵网格背景 (Figma 风格) */
.luban-designer__canvas--grid {
  background-image: radial-gradient(circle, #d4d4d8 1px, transparent 1px);
  background-size: 8px 8px;
}

/* 拖入高亮 */
.luban-designer__canvas--drop-active {
  background-color: #ecf5ff;
}

.luban-designer__canvas--drop-active.luban-designer__canvas--grid {
  background-image: radial-gradient(circle, #d4d4d8 1px, transparent 1px),
    linear-gradient(rgba(64, 158, 255, 0.06), rgba(64, 158, 255, 0.06));
}

/* === 视口（缩放/平移容器） === */
.luban-designer__viewport {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  box-sizing: border-box;
}

/* === 根容器白卡 === */
.luban-designer__root-container {
  width: 100%;
  max-width: 1200px;
  min-height: 600px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
  padding: 24px;
  box-sizing: border-box;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  background: #fafafa;
  font-size: 14px;
  gap: 8px;
}

/* 空画布引导语 */
.luban-designer__placeholder::before {
  content: '📦';
  font-size: 32px;
  opacity: 0.5;
}

.luban-designer__canvas-spacer {
  width: 100%;
  max-width: 1200px;
  min-height: 200px;
  border: 2px dashed transparent;
  border-radius: 8px;
  margin-top: 16px;
  transition: border-color 0.2s, background-color 0.2s;
}

.luban-designer__canvas-spacer--active {
  border-color: #409eff;
  background-color: rgba(64, 158, 255, 0.04);
}

/* 插入位置指示线 */
.luban-designer__insert-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #409eff;
  z-index: 102;
  pointer-events: none;
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.4);
}

/* === 内置工具栏 === */
.luban-designer__builtin-toolbar {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 4px 8px;
  user-select: none;
}

.luban-designer__zoom-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.luban-designer__zoom-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.luban-designer__zoom-btn:hover:not(:disabled) {
  background: #f0f2f5;
}

.luban-designer__zoom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.luban-designer__zoom-btn--fit {
  font-size: 16px;
  margin-left: 4px;
  border-left: 1px solid #ebeef5;
  padding-left: 6px;
}

.luban-designer__zoom-label {
  font-size: 12px;
  color: #606266;
  min-width: 40px;
  text-align: center;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.luban-designer__zoom-label:hover {
  background: #f0f2f5;
}

.luban-designer__toggles {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 8px;
  border-left: 1px solid #ebeef5;
}

.luban-designer__toggle-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.luban-designer__toggle-btn:hover {
  background: #f0f2f5;
  color: #606266;
}

.luban-designer__toggle-btn--active {
  color: #409eff;
  background: #ecf5ff;
}

/* 拖放预览 ghost */
.luban-designer__drop-preview {
  position: absolute;
  z-index: 155;
  pointer-events: none;
  background: rgba(64, 158, 255, 0.85);
  color: #fff;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.3);
}

/* === 拖入提示浮层 === */
.luban-designer__drop-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 150;
  background: rgba(64, 158, 255, 0.9);
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.luban-designer__drop-hint-icon {
  font-size: 18px;
}

/* 拖放失败错误提示 */
.luban-designer__drop-error {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 160;
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

/* === V2-T12 对齐辅助线 === */
.luban-designer__guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100;
}

.luban-designer__guide {
  position: absolute;
  background: #ff3b30;
}

.luban-designer__guide--vertical {
  width: 1px;
}

.luban-designer__guide--horizontal {
  height: 1px;
}

/* V2-T12 间距提示 */
.luban-designer__spacing {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 101;
}

.luban-designer__spacing-label {
  position: absolute;
  transform: translate(-50%, -50%);
  background: #4090ff;
  color: #fff;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

/* V2-T11 框选矩形 */
.luban-designer__frame-box {
  position: absolute;
  border: 1px solid #4090ff;
  background: rgba(64, 144, 255, 0.12);
  pointer-events: none;
  z-index: 99;
}
</style>
