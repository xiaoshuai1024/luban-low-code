/**
 * LubanBanner 物料定义（content/banner）。
 *
 * propsSchema 与 luban-base 的 LubanBanner.vue defineProps + withDefaults
 * 逐字段对齐，作为单一事实来源（反漂移）。
 *
 * 修漂移说明：旧 componentMeta 错误声明 content 字段，但 Vue 组件
 * 实际 props 为 src / alt / href / height / objectFit（无 content）。
 * 本定义按 Vue 组件纠正。
 *
 * Vue 来源：packages/luban-base/src/lib/content/LubanBanner.vue
 *   - ObjectFit = 'cover' | 'contain' | 'fill' | 'none'
 *   - src: string（必填，无默认）
 *   - alt: string，默认 ''
 *   - href?: string（可选，无默认）
 *   - height?: number | string（可选，无默认；'auto' 表示自然高度）
 *   - objectFit: ObjectFit，默认 'cover'
 *
 * @since 0.1.0
 */

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanBanner } from 'luban-base';

/**
 * 横幅（图片）物料。
 *
 * src 为必填（UI 标红星提示用户填写），但 propsSchema.default 设为 ''
 * 以保证渲染时不阻断（缺 src 时 img 为空，不抛错）。
 *
 * 注：JSONSchemaProperty.type 为单值字符串，height 实际接受 number|string。
 *     此处以 'string' 声明（接受 'auto' 或 CSS 值），数值由调用方传入时
 *     由运行时按 number 分支处理（见 LubanBanner.vue 的 height 计算逻辑）。
 *     若后续 schema 类型扩展为 union，可改为更精确的声明。
 */
export const bannerMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanBanner',
  version: '1.0.0',
  category: 'content',
  description: '横幅图片，支持链接包装、自定义高度与 object-fit',
  component: LubanBanner,
  propsSchema: {
    type: 'object',
    description: 'LubanBanner 横幅图片组件属性',
    required: ['src'],
    properties: {
      src: {
        type: 'string',
        description: '图片 URL（必填；未填时图片为空，但不阻断渲染）',
        default: '',
        label: '图片地址',
      },
      alt: {
        type: 'string',
        description: '图片替代文本（无障碍用）',
        default: '',
        label: '替代文本',
      },
      href: {
        type: 'string',
        description: '可选链接 URL；设置时横幅以 <a> 包裹并可跳转',
        default: '',
        label: '链接',
      },
      height: {
        type: 'string',
        description:
          "高度：数字（按 px）或字符串（CSS 值或 'auto' 表示自然高度）。" +
          '声明为 string 类型，数值由运行时按 number 分支处理。',
        default: '',
        label: '高度',
      },
      objectFit: {
        type: 'string',
        description: '图片 object-fit 填充方式',
        enum: ['cover', 'contain', 'fill', 'none'],
        default: 'cover',
        label: '填充方式',
      },
    },
  },
  events: [
    {
      name: 'click',
      description:
        '点击事件（参数：原生 MouseEvent）。仅在未设置 href 时触发；' +
        '设置 href 后点击由 <a> 默认导航处理，不冒泡 click 事件。',
    },
  ],
});
