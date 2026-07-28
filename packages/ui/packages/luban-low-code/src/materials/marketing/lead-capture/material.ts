/**
 * LubanLeadCapture 物料定义（marketing/lead-capture）。
 *
 * Vue 来源：packages/luban-base/src/lib/content/LubanLeadCapture.vue
 *   - heading: string（必填）
 *   - description?: string
 *   - submitText?: string，默认 '提交'
 *   - placeholder?: string，默认 '请输入您的联系方式'
 *   - backgroundColor?: string，默认 '#f9fafb'
 *   - showName?: boolean，默认 true
 *   - showPhone?: boolean，默认 true
 *   - showEmail?: boolean，默认 false
 *   - formId?: string（D15-E2：提交链路关联表单 ID）
 *   - successText?: string（D15-E2：提交成功提示）
 *
 * D15-E2 升级：组件 emit('submit', fields)，RuntimeRenderer 转发到 lubanFormSubmit。
 */

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanLeadCapture } from 'luban-base';

export const leadCaptureMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanLeadCapture',
  version: '1.1.0',
  category: 'marketing',
  description: '线索采集区块，展示标题、描述与联系方式输入表单（提交生成 lead）',
  component: LubanLeadCapture,
  /** D15-E3：声明 submit 事件，供设计器事件编排识别 */
  events: [{ name: 'submit', description: '提交表单（payload 为字段 map）' }],
  propsSchema: {
    type: 'object',
    required: ['heading'],
    properties: {
      heading: { type: 'string', default: '获取最新资讯', label: '标题' },
      description: { type: 'string', default: '', label: '描述' },
      submitText: { type: 'string', default: '提交', label: '提交按钮' },
      placeholder: { type: 'string', default: '请输入您的联系方式', label: '占位提示' },
      backgroundColor: { type: 'string', default: '#f9fafb', label: '背景色' },
      showName: { type: 'boolean', default: true, label: '显示姓名' },
      showPhone: { type: 'boolean', default: true, label: '显示手机号' },
      showEmail: { type: 'boolean', default: false, label: '显示邮箱' },
      formId: { type: 'string', default: '', label: '关联表单ID（提交用）' },
      successText: { type: 'string', default: '提交成功，我们会尽快与您联系', label: '成功提示' },
    },
  },
});

export default leadCaptureMaterial;
