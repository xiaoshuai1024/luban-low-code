<script setup lang="ts">
/**
 * ResizeHandles.vue — W1-T2 8 向 resize 手柄。
 *
 * 选中节点时在 DesignRenderer wrapper 上叠加 8 个手柄（4 角 + 4 边中点）。
 * 拖拽手柄 → 实时更新 node.layout.width/height（absolute）或 node.style.width/height（static）。
 * 角点拖拽同时改 width+height；边点改单方向。
 *
 * 通过 inject('lb-resize-target') 获取被选中节点的 DOM rect + nodeId，
 * 计算 overlay 定位。拖拽时 emit('resize', {width, height}) 通知父级回写 schema。
 */
import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  /** 选中节点的 schema 引用（直接 mutate layout/style） */
  nodeId: string;
  /** 节点是否绝对定位（决定写 layout 还是 style） */
  isAbsolute: boolean;
  /** 节点 DOM 元素（用于测量初始尺寸） */
  el: HTMLElement | null;
}>();

const emit = defineEmits<{
  (e: 'resize-start'): void;
  (e: 'resize-end'): void;
}>();

/** 当前拖拽中的手柄方向（null=未拖拽） */
const dragging = ref<string | null>(null);
/** 拖拽中实时尺寸标注（W×H px） */
const sizeLabel = ref<{ w: number; h: number; x: number; y: number } | null>(null);

/** 8 个手柄定义 */
const HANDLES = [
  { dir: 'nw', cursor: 'nwse-resize', style: { left: '-4px', top: '-4px' } },
  { dir: 'n', cursor: 'ns-resize', style: { left: '50%', top: '-4px', transform: 'translateX(-50%)' } },
  { dir: 'ne', cursor: 'nesw-resize', style: { right: '-4px', top: '-4px' } },
  { dir: 'e', cursor: 'ew-resize', style: { right: '-4px', top: '50%', transform: 'translateY(-50%)' } },
  { dir: 'se', cursor: 'nwse-resize', style: { right: '-4px', bottom: '-4px' } },
  { dir: 's', cursor: 'ns-resize', style: { left: '50%', bottom: '-4px', transform: 'translateX(-50%)' } },
  { dir: 'sw', cursor: 'nesw-resize', style: { left: '-4px', bottom: '-4px' } },
  { dir: 'w', cursor: 'ew-resize', style: { left: '-4px', top: '50%', transform: 'translateY(-50%)' } },
] as const;

/**
 * 开始 resize 拖拽。
 * @param dir 手柄方向（n/s/e/w/nw/ne/sw/se）
 * @param e mousedown 事件
 * @param nodeEl 选中节点的 DOM 元素（由 DesignRenderer 传入）
 */
function startResize(dir: string, e: MouseEvent, nodeEl: HTMLElement | null): void {
  if (!nodeEl) return;
  e.preventDefault();
  e.stopPropagation();
  dragging.value = dir;
  emit('resize-start');

  const startX = e.clientX;
  const startY = e.clientY;
  const rect = nodeEl.getBoundingClientRect();
  const startW = rect.width;
  const startH = rect.height;

  function onMove(ev: MouseEvent): void {
    let w = startW;
    let h = startH;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    // 根据方向计算新尺寸
    if (dir.includes('e')) w = startW + dx;
    if (dir.includes('w')) w = startW - dx;
    if (dir.includes('s')) h = startH + dy;
    if (dir.includes('n')) h = startH - dy;

    w = Math.max(20, Math.round(w));
    h = Math.max(20, Math.round(h));

    // 实时尺寸标注
    sizeLabel.value = { w, h, x: ev.clientX, y: ev.clientY };

    // 回写（由父组件通过 inject 提供的回调消费）
    // 这里直接 emit，父组件写 schema
    window.dispatchEvent(new CustomEvent('lb-resize', {
      detail: { nodeId: props.nodeId, width: w, height: h, isAbsolute: props.isAbsolute }
    }));
  }

  function onUp(): void {
    dragging.value = null;
    sizeLabel.value = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    emit('resize-end');
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
</script>

<template>
  <div class="resize-handles" @mousedown.stop @click.stop>
    <div
      v-for="h in HANDLES"
      :key="h.dir"
      class="resize-handles__handle"
      :style="{ ...h.style, cursor: h.cursor }"
      @mousedown="(e) => startResize(h.dir, e, el)"
    />
    <!-- 拖拽中尺寸标注 -->
    <div
      v-if="sizeLabel"
      class="resize-handles__label"
      :style="{ left: sizeLabel.x + 12 + 'px', top: sizeLabel.y + 12 + 'px', position: 'fixed' }"
    >
      {{ sizeLabel.w }} × {{ sizeLabel.h }}
    </div>
  </div>
</template>

<style scoped>
.resize-handles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.resize-handles__handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #fff;
  border: 1.5px solid #1890ff;
  border-radius: 2px;
  pointer-events: auto;
  z-index: 11;
}

.resize-handles__handle:hover {
  background: #1890ff;
}

.resize-handles__label {
  position: fixed;
  background: #1890ff;
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
  font-family: monospace;
}
</style>
