import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanAlert from './LubanAlert.vue';

export const alertMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanAlert',
  version: '1.0.0',
  category: 'feedback',
  description: '提示信息块（info/warning/error/success 四种变体），可用作文档 callout',
  component: LubanAlert,
  propsSchema: {
    type: 'object',
    description: 'LubanAlert props',
    properties: {
      title:    { type: 'string',  description: '标题（可选）', default: '', label: '标题' },
      content:  { type: 'string',  description: '内容', default: '', label: '内容' },
      type:     { type: 'string',  enum: ['info','warning','error','success'], default: 'info', label: '类型' },
      closable: { type: 'boolean', default: false, label: '可关闭' },
      showIcon: { type: 'boolean', default: true,  label: '显示图标' },
    },
  },
  events: [{ name: 'close', description: '关闭事件' }],
});
