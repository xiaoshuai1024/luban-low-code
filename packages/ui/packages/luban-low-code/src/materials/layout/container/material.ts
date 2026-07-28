/**
 * LubanContainer 物料定义（layout 组）。
 *
 * 通用容器：以最大宽度档位 + 内边距开关约束内容区域，作为页面根级布局容器。
 *
 * @since 0.1.0
 */

import { LubanContainer } from 'luban-base';
import { defineMaterial } from '../../../lib/material/defineMaterial';

export const containerMaterial = defineMaterial({
  name: 'LubanContainer',
  version: '0.1.0',
  category: 'layout',
  description: '通用容器：限定最大宽度档位并提供内边距开关，用于页面根级布局。',
  component: LubanContainer,
  isContainer: true,
  propsSchema: {
    type: 'object',
    properties: {
      maxWidth: {
        type: 'string',
        description: '最大宽度档位。full 表示撑满父级。',
        enum: ['sm', 'md', 'lg', 'full'],
        default: 'full',
        label: '最大宽度',
      },
      padded: {
        type: 'boolean',
        description: '是否启用内边距（lb-container--padded）。',
        default: false,
        label: '内边距',
      },
    },
  },
  slots: [{ name: 'default', description: '容器内容（子节点）' }],
});
