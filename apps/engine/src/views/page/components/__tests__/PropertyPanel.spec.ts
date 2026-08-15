/**
 * PropertyPanel.spec.ts — 属性面板撤销时序单测（close-review-gaps 5.2/5.7）。
 *
 * 验收：props/style/events 三分区不再直改 props.node（只 emit key/value），
 * 写入由 PageEditor handler 在 history.push() 之后统一收口 —— 保证快照为
 * 变更前状态，属性修改可被 undo 恢复。同时验证危险 CSS 值仍被静默拒绝。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PropertyPanel from '../PropertyPanel.vue'
import type { NodeSchema } from '@/types/schema'
import type { ComponentMeta } from 'luban-low-code'

function makeNode(): NodeSchema {
  return { id: 'n1', type: 'LubanButton', props: { text: '按钮' }, style: {} }
}

function makeMeta(): ComponentMeta {
  return {
    name: 'LubanButton',
    label: '按钮',
    defaultProps: { text: '按钮' },
    propSchema: { text: { type: 'string', label: '文本' } },
    events: ['click'],
  } as unknown as ComponentMeta
}

function mountPanel(node: NodeSchema) {
  return mount(PropertyPanel, {
    props: { node, meta: makeMeta(), datasources: [], collections: [] },
  })
}

describe('PropertyPanel 撤销时序（不直改 props.node，仅 emit）', () => {
  it('props 分区：输入只 emit update:prop，不直改 node.props', async () => {
    const node = makeNode()
    const wrapper = mountPanel(node)
    const input = wrapper.find('input[placeholder="请输入文本"]')
    expect(input.exists()).toBe(true)
    await input.setValue('新文案')

    expect(wrapper.emitted('update:prop')).toEqual([['n1', 'text', '新文案']])
    // 关键：面板不直接改 props.node（写入由 PageEditor 在 history.push 后完成）
    expect(node.props.text).toBe('按钮')
  })

  it('style 分区：输入只 emit update:style，不直改 node.style', async () => {
    const node = makeNode()
    const wrapper = mountPanel(node)
    const input = wrapper.find('input[placeholder="width"]')
    expect(input.exists()).toBe(true)
    await input.setValue('100px')

    expect(wrapper.emitted('update:style')).toEqual([['n1', 'width', '100px']])
    expect(node.style).toEqual({}) // 未被直改
  })

  it('style 分区：危险 CSS 值被拒绝（不 emit、不写入）', async () => {
    const node = makeNode()
    const wrapper = mountPanel(node)
    const input = wrapper.find('input[placeholder="width"]')
    await input.setValue('javascript:alert(1)')
    expect(wrapper.emitted('update:style')).toBeUndefined()
    expect(node.style).toEqual({})
  })

  it('events 分区：输入只 emit update:event，不直改 node.events', async () => {
    const node = makeNode()
    const wrapper = mountPanel(node)
    const input = wrapper.find('input[placeholder="动作表达式，如 navigate(\'/x\')"]')
    expect(input.exists()).toBe(true)
    await input.setValue("navigate('/x')")

    expect(wrapper.emitted('update:event')).toEqual([['n1', 'click', "navigate('/x')"]])
    expect(node.events).toBeUndefined() // 未被直改
  })
})
