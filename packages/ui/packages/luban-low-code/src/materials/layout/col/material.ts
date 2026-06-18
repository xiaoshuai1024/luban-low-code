/**
 * LubanCol 物料定义（layout 组）。
 *
 * flex 列：作为 LubanRow 的子项，通过 grow/basis/alignSelf 控制弹性与对齐。
 *
 * 漂移修正（相对旧 componentMeta）：
 *  - basis：默认值由 number 50 修正为 'auto'（与 Vue withDefaults 一致；
 *    Vue 类型为 number|string，number 解释为百分比，string 原样作为 flex-basis）；
 *  - grow：默认值由 1 修正为 0（与 Vue withDefaults 一致）；
 *  - 补 alignSelf（auto/start/center/end/stretch，默认 auto）。
 *
 * @since 0.1.0
 */

import { LubanCol } from 'luban-base';
import { defineMaterial } from '../../../lib/material/defineMaterial';

export const colMaterial = defineMaterial({
  name: 'LubanCol',
  version: '0.1.0',
  category: 'layout',
  description: 'flex 列：作为 LubanRow 子项，控制弹性增长、基础宽度与自身对齐。',
  component: LubanCol,
  isContainer: true,
  acceptTypes: ['LubanRow'],
  propsSchema: {
    type: 'object',
    properties: {
      grow: {
        type: 'number',
        description: 'flex-grow：分配剩余空间的权重。0 表示不增长。',
        default: 0,
        label: 'flex-grow',
      },
      basis: {
        type: 'string',
        description:
          'flex-basis：number 解释为百分比（如 50 表示 50%），string 原样作为 CSS flex-basis。',
        default: 'auto',
        label: '基础宽度',
      },
      alignSelf: {
        type: 'string',
        description: '自身在交叉轴上的对齐，覆盖父级 align-items。auto 表示继承。',
        enum: ['auto', 'start', 'center', 'end', 'stretch'],
        default: 'auto',
        label: '自身对齐',
      },
    },
  },
  slots: [{ name: 'default', description: '列内容（子节点）' }],
});
