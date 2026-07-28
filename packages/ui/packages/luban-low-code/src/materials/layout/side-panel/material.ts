/**
 * LubanSidePanel 物料定义（layout 组）。
 *
 * 侧滑面板：右侧滑出的模态面板，含 header/body/footer 三段式结构，
 * 通过 v-model:visible 控制显隐。
 *
 * 此前 componentMeta 未注册该物料的任何 meta，本文件为首份元数据声明，
 * props/events/slots 均按 Vue 组件 LubanSidePanel.vue 全量对齐。
 *
 * @since 0.1.0
 */

import { LubanSidePanel } from 'luban-base';
import { defineMaterial } from '../../../lib/material/defineMaterial';

export const sidePanelMaterial = defineMaterial({
  name: 'LubanSidePanel',
  version: '0.1.0',
  category: 'layout',
  description: '侧滑面板：右侧滑出的模态面板，支持 header/body/footer 插槽与 v-model:visible。',
  component: LubanSidePanel,
  isContainer: true,
  propsSchema: {
    type: 'object',
    properties: {
      modelValue: {
        type: 'boolean',
        description: '是否可见（v-model:visible）。false 时面板不渲染。',
        default: true,
        label: '可见',
      },
      title: {
        type: 'string',
        description: '面板标题，展示在 header 左侧（当未提供 header 插槽时生效）。',
        default: '',
        label: '标题',
      },
      size: {
        type: 'string',
        description: '面板宽度档位：small≈480px、medium≈640px、large≈800px；窄屏自适应撑满。',
        enum: ['small', 'medium', 'large'],
        default: 'medium',
        label: '尺寸',
      },
      closable: {
        type: 'boolean',
        description: '是否显示右上角关闭按钮。',
        default: true,
        label: '可关闭',
      },
    },
  },
  events: [
    {
      name: 'update:modelValue',
      description: '显隐变更（v-model:visible），关闭时 payload 为 false。',
    },
    { name: 'close', description: '面板关闭时触发（点击关闭按钮）' },
  ],
  slots: [
    { name: 'header', description: '自定义头部内容（覆盖 title）' },
    { name: 'body', description: '主体内容；未提供时回退到 default 插槽' },
    { name: 'footer', description: '底部操作区' },
    { name: 'default', description: '默认内容，作为 body 回退' },
  ],
});
