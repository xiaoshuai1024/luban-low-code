import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanCodeBlock from './LubanCodeBlock.vue';

export const codeBlockMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanCodeBlock',
  version: '1.0.0',
  category: 'data-display',
  description: '代码片段展示，支持语法高亮与一键复制',
  component: LubanCodeBlock,
  propsSchema: {
    type: 'object',
    description: 'LubanCodeBlock props',
    properties: {
      code:       { type: 'string',  description: '代码内容', default: '', label: '代码' },
      language:   { type: 'string', enum: ['javascript','typescript','html','css','json','bash','python','java','sql','yaml','markdown','plain'], default: 'plain', label: '语言' },
      showCopy:   { type: 'boolean', default: true,  label: '显示复制按钮' },
      showHeader: { type: 'boolean', default: false, label: '显示语言头栏' },
      collapsed:  { type: 'boolean', default: false, label: '折叠模式' },
      maxHeight:  { type: 'string',  default: '', label: '最大高度（如 400px）' },
    },
  },
});
