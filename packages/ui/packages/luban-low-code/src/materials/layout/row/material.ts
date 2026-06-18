/**
 * LubanRow 物料定义（layout 组）。
 *
 * flex 行容器：按方向（行/列）排列子节点，提供对齐、间距与换行开关。
 *
 * 漂移修正（相对旧 componentMeta）：
 *  - align：删除 Vue 组件不支持的 'stretch'，仅保留 start/center/end；
 *  - justify：删除 Vue 组件不支持的 'around'，仅保留 start/center/end/between；
 *  - gap：默认值 16 → 0（与 Vue withDefaults 一致）；
 *  - 补 direction（row/column，默认 row）、wrap（默认 true）。
 *
 * @since 0.1.0
 */

import { LubanRow } from 'luban-base';
import { defineMaterial } from '../../../lib/material/defineMaterial';

export const rowMaterial = defineMaterial({
  name: 'LubanRow',
  version: '0.1.0',
  category: 'layout',
  description: 'flex 行/列容器：按方向排列子节点，提供对齐、间距与换行控制。',
  component: LubanRow,
  isContainer: true,
  propsSchema: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        description: '主轴方向。row 为水平排列，column 为垂直排列。',
        enum: ['row', 'column'],
        default: 'row',
        label: '方向',
      },
      align: {
        type: 'string',
        description: '交叉轴对齐方式（align-items）。',
        enum: ['start', 'center', 'end'],
        default: 'start',
        label: '交叉轴对齐',
      },
      justify: {
        type: 'string',
        description: '主轴对齐方式（justify-content）。',
        enum: ['start', 'center', 'end', 'between'],
        default: 'start',
        label: '主轴对齐',
      },
      gap: {
        type: 'number',
        description: '子节点间距（px）。0 表示不设置间距。',
        default: 0,
        label: '间距',
      },
      wrap: {
        type: 'boolean',
        description: '是否允许子节点换行。',
        default: true,
        label: '换行',
      },
    },
  },
  slots: [{ name: 'default', description: '行内容（子节点）' }],
});
