/**
 * LubanContentList 物料定义（content/content-list）。
 *
 * Vue 来源：packages/luban-base/src/lib/content/LubanContentList.vue
 * V2-T7 CMS 内容列表组件：接收 CMS 绑定注入的 items 数组渲染卡片网格。
 *
 * 字段映射 props（titleKey/bodyKey/imageKey/linkKey）指定从每条 item 取哪个字段；
 * 运行态由 LubanPage CMS 绑定解析后注入 items（见 cmsBinding.ts）。
 */
import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanContentList } from 'luban-base';

export const contentListMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanContentList',
  version: '1.0.0',
  category: 'content',
  description: 'CMS 内容列表，绑定 collection 后自动渲染内容卡片网格',
  component: LubanContentList,
  propsSchema: {
    type: 'object',
    properties: {
      items: { type: 'array', default: [], label: '内容项（CMS 绑定自动注入）' },
      titleKey: { type: 'string', default: 'title', label: '标题字段' },
      bodyKey: { type: 'string', default: 'body', label: '正文字段' },
      imageKey: { type: 'string', default: 'image', label: '图片字段' },
      linkKey: { type: 'string', default: 'link', label: '链接字段' },
      columns: { type: 'number', default: 3, label: '列数' },
      emptyText: { type: 'string', default: '暂无内容', label: '空状态文案' },
    },
  },
});

export default contentListMaterial;
