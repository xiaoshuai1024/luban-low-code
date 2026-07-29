/**
 * LubanTable 物料定义（data-display/table）。
 *
 * 数据表格：通过 columns 定义列，datasourceId 绑定数据源（RuntimeRenderer
 * 将 datasource 解析结果以 rows 注入组件），支持分页大小、斑马纹、边框。
 *
 * propsSchema 字段（全字段声明 default）：
 *  - columns:     array<{ label:string, key:string, width?:string|number }>
 *                 （默认 []）
 *  - datasourceId: string（默认 ''，运行时由 PropertyPanel 绑数据源覆盖）
 *  - pageSize:    number（默认 10；<=0 表示不分页）
 *  - striped:     boolean（默认 false）
 *  - border:      boolean（默认 true）
 * events: rowClick(row)
 * slots:  empty（无数据占位）
 *
 * 注：组件实现为轻量自研 Vue3 组件（Material Design 风格），不依赖
 * element-plus；rows 由运行时注入，不进入 propsSchema。
 *
 * @since 1.0.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanTable from './LubanTable.vue';

export const tableMaterial = defineMaterial({
  name: 'LubanTable',
  version: '1.0.0',
  category: 'data-display',
  description: '数据表格：列定义 + 数据源绑定，支持分页/斑马纹/边框',
  component: LubanTable,
  propsSchema: {
    type: 'object',
    description: 'LubanTable 数据表格属性',
    properties: {
      columns: {
        type: 'array',
        label: '列定义',
        description: '表格列集合，每项 { label, key, width? }',
        default: [],
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', label: '列标题', default: '' },
            key: { type: 'string', label: '数据字段', default: '' },
            width: {
              type: 'string',
              label: '列宽',
              description: '列宽（数字视为 px，字符串原样使用，如 "20%"）',
            },
          },
        },
      },
      datasourceId: {
        type: 'string',
        label: '数据源',
        description: '绑定的数据源 ID（由 PropertyPanel 数据源区写入）',
        default: '',
      },
      pageSize: {
        type: 'number',
        label: '每页条数',
        description: '分页大小；<=0 表示不分页',
        default: 10,
      },
      striped: {
        type: 'boolean',
        label: '斑马纹',
        default: false,
      },
      border: {
        type: 'boolean',
        label: '边框',
        default: true,
      },
    },
  },
  events: [
    {
      name: 'rowClick',
      description: '行点击事件（参数：该行记录对象 row）',
    },
  ],
  slots: [
    {
      name: 'empty',
      description: '无数据时的占位内容（默认显示「暂无数据」）',
    },
  ],
});
