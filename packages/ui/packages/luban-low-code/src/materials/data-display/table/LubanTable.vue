<script setup lang="ts">
/**
 * LubanTable — 数据表格物料组件（data-display/table）。
 *
 * 轻量自研实现（Material Design 风格），不依赖 element-plus。
 * - columns: { label, key, width? }[] 列定义
 * - rows:    数据行数组（datasource 解析后的记录集，由 RuntimeRenderer 注入）
 * - pageSize: 分页大小（<=0 表示不分页；>0 且 rows.length>pageSize 时启用客户端分页）
 * - striped / border: 视觉开关
 *
 * 物料态由 RuntimeRenderer 传入 datasource 解析结果作为 rows；
 * 设计期 rows 可空，组件展示 empty 插槽。
 */
import { computed, ref, watch } from 'vue';

interface TableColumn {
  label: string;
  key: string;
  width?: number | string;
}

const props = withDefaults(
  defineProps<{
    columns?: TableColumn[];
    /** 数据行（datasource 解析结果；物料 propsSchema 不直接暴露 rows，由运行时注入） */
    rows?: Record<string, unknown>[];
    datasourceId?: string;
    pageSize?: number;
    striped?: boolean;
    border?: boolean;
  }>(),
  {
    columns: () => [],
    rows: () => [],
    datasourceId: '',
    pageSize: 10,
    striped: false,
    border: true,
  }
);

defineEmits<{
  /** 行点击（参数：该行记录对象） */
  rowClick: [row: Record<string, unknown>];
}>();

function normaliseWidth(width: number | string | undefined): string | undefined {
  if (width == null || width === '') return undefined;
  return typeof width === 'number' ? `${width}px` : String(width);
}

// ===== Client-side pagination (H1: pageSize schema previously declared but unused) =====
const currentPage = ref(1);

// 分页仅在 pageSize>0 且数据量超过单页时启用；否则整表渲染（向后兼容现有用例）。
const pagingEnabled = computed(
  () => props.pageSize > 0 && props.rows.length > props.pageSize
);
const totalPages = computed(() =>
  pagingEnabled.value
    ? Math.max(1, Math.ceil(props.rows.length / props.pageSize))
    : 1
);
const pagedRows = computed(() => {
  if (!pagingEnabled.value) return props.rows;
  const start = (currentPage.value - 1) * props.pageSize;
  return props.rows.slice(start, start + props.pageSize);
});

// rows/pageSize 变化时把页码拉回合法范围（越界则回到末页 / 首页）。
watch(
  () => [props.rows, props.pageSize] as const,
  () => {
    if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
    if (currentPage.value < 1) currentPage.value = 1;
  },
  { flush: 'post' }
);

function goPrev(): void {
  if (currentPage.value > 1) currentPage.value -= 1;
}
function goNext(): void {
  if (currentPage.value < totalPages.value) currentPage.value += 1;
}

// 稳定行 key（M3: 原 :key="idx" 在排序/筛选/插入时会致 Vue diff 复用错行）。
// 优先用 row 在第一列字段上的值；退化到页内序号（分页后页内唯一即可）。
function rowKey(row: Record<string, unknown>, idx: number): string | number {
  for (const col of props.columns) {
    const v = row?.[col.key];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return idx;
}
</script>

<template>
  <div class="lb-table" :class="{ 'lb-table--border': border }">
    <table class="lb-table__table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :style="{ width: normaliseWidth(col.width) }"
            class="lb-table__th"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in pagedRows"
          :key="rowKey(row, idx)"
          class="lb-table__row"
          :class="{ 'lb-table__row--striped': striped && idx % 2 === 1 }"
          @click="$emit('rowClick', row)"
        >
          <td v-for="col in columns" :key="col.key" class="lb-table__td">
            {{ row?.[col.key] ?? '' }}
          </td>
        </tr>
        <tr v-if="rows.length === 0" class="lb-table__empty-row">
          <td :colspan="Math.max(columns.length, 1)" class="lb-table__empty">
            <slot name="empty">暂无数据</slot>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="pagingEnabled" class="lb-table__pagination">
      <button
        type="button"
        class="lb-table__page-btn"
        :disabled="currentPage <= 1"
        aria-label="上一页"
        @click="goPrev"
      >
        上一页
      </button>
      <span class="lb-table__page-info">
        {{ currentPage }} / {{ totalPages }}
      </span>
      <button
        type="button"
        class="lb-table__page-btn"
        :disabled="currentPage >= totalPages"
        aria-label="下一页"
        @click="goNext"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
// TODO(design-token): 当前 luban-low-code 物料硬编码色值/圆角；
// 待 luban-base 暴露可跨包消费的 token 入口（scss alias 或 CSS 变量）后，
// 迁移到 $lb-primary / $lb-border-radius 等 token。
// 参考：packages/luban-base/src/styles/_variables.scss
.lb-table {
  width: 100%;
  overflow-x: auto;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.87);
  background: #fff;

  &__table {
    width: 100%;
    border-collapse: collapse;
  }

  &__th {
    text-align: left;
    padding: 12px 16px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    background: #fafafa;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    white-space: nowrap;
  }

  &__td {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    color: rgba(0, 0, 0, 0.87);
  }

  &__row {
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background: rgba(25, 118, 210, 0.04);
    }
  }

  &__row--striped {
    background: #fafafa;
  }

  &__empty {
    text-align: center;
    padding: 24px 16px;
    color: rgba(0, 0, 0, 0.4);
  }

  &--border &__table {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }

  &__pagination {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 8px 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }

  &__page-btn {
    appearance: none;
    background: transparent;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 13px;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.87);

    &:hover:not(:disabled) {
      border-color: #1976d2;
      color: #1976d2;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  &__page-info {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.6);
  }
}
</style>
