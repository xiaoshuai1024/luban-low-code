/**
 * LubanText 物料定义（general/text）。
 *
 * propsSchema 与 luban-base 的 LubanText.vue defineProps + withDefaults
 * 逐字段对齐，作为单一事实来源（反漂移）。
 *
 * 修漂移说明：旧 componentMeta 仅有 content 一个字段，遗漏了
 * tag / variant / secondary 三个实际 prop。本定义按 Vue 组件补齐。
 *
 * Vue 来源：packages/luban-base/src/lib/content/LubanText.vue
 *   - TextTag     = 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
 *   - TextVariant = 'body1' | 'body2' | 'caption' | 'h1' | 'h2' | 'h3'
 *
 * @since 0.1.0
 */

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanText } from 'luban-base';

/**
 * 文本物料。
 *
 * default 对齐 Vue withDefaults：tag 'p' / variant 'body1' / secondary false / content ''。
 */
export const textMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanText',
  version: '1.0.0',
  category: 'general',
  description: '通用文本，支持语义化标签、排版变体与次色样式',
  component: LubanText,
  propsSchema: {
    type: 'object',
    description: 'LubanText 文本组件属性',
    properties: {
      content: {
        type: 'string',
        description: '文本内容；当未传入默认插槽时展示',
        default: '',
        label: '内容',
      },
      tag: {
        type: 'string',
        description: '语义化 HTML 标签',
        enum: ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        default: 'p',
        label: '标签',
      },
      variant: {
        type: 'string',
        description: '排版变体，映射到 lb-text--* 样式类',
        enum: ['body1', 'body2', 'caption', 'h1', 'h2', 'h3'],
        default: 'body1',
        label: '排版',
      },
      secondary: {
        type: 'boolean',
        description: '是否使用次色文本（lb-text--secondary）',
        default: false,
        label: '次色',
      },
    },
  },
  slots: [
    {
      name: 'default',
      description: '默认插槽，覆盖 content；未传入时回退到 content',
    },
  ],
});
