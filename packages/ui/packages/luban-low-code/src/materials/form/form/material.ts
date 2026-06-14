/**
 * LubanForm 物料定义（form/form）。
 *
 * 表单容器：渲染为 <form>，按 size 控制最大宽度，支持子物料拖入
 * （表单控件）并通过 submit 事件对外暴露提交。
 *
 * propsSchema 来源：packages/luban-base/src/lib/form/LubanForm.vue
 *  - size: FormSize = 'small' | 'medium' | 'large'（withDefaults 默认 'medium'）
 *  - onSubmit: 回调型 prop，不进 propsSchema（事件由 events.submit 表达）
 *
 * 旧 componentMeta.ts 中 LubanForm 的 propSchema 为空 {}，本文件按
 * 组件实际 props 全量补齐 size 字段。
 *
 * @since 0.1.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import { getComponent } from '../../../lib/registry';

/**
 * 表单控件子物料类型（与 componentMeta.ts buildDefaultMeta 的
 * FORM_CONTROL_TYPES 保持一致，作为 LubanForm.acceptTypes）。
 */
const FORM_CONTROL_TYPES = [
  'LubanInput',
  'LubanTextArea',
  'LubanSelect',
  'LubanCheckbox',
  'LubanRadioGroup',
  'LubanSwitch',
];

export const formMaterial = defineMaterial({
  name: 'LubanForm',
  version: '0.1.0',
  category: 'form',
  description: '表单',
  component: getComponent('LubanForm')!,
  /** 表单为容器：可在设计器中拖入表单控件作为子节点。 */
  isContainer: true,
  /** 仅接受表单控件类子物料。 */
  acceptTypes: FORM_CONTROL_TYPES,
  propsSchema: {
    type: 'object',
    properties: {
      size: {
        type: 'string',
        label: '尺寸',
        description: '表单最大宽度档位：small(600px) / medium(800px) / large(960px)',
        enum: ['small', 'medium', 'large'],
        default: 'medium',
      },
    },
  },
  events: [
    {
      name: 'submit',
      description: '表单提交（@submit.prevent 触发）',
    },
  ],
  slots: [
    {
      name: 'default',
      description: '表单内容（表单控件等子物料挂载点）',
    },
  ],
});
