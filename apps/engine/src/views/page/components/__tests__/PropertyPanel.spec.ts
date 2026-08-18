/**
 * PropertyPanel.spec.ts — 属性面板撤销时序单测（close-review-gaps 5.2/5.7 +
 * close-tech-debt-1 1.6）。
 *
 * 验收：props/style/events 三分区不再直改 props.node（只 emit key/value），
 * 写入由 PageEditor handler 在 history.push() 之后统一收口 —— 保证快照为
 * 变更前状态，属性修改可被 undo 恢复。同时验证危险 CSS 值仍被静默拒绝。
 *
 * close-tech-debt-1：animation/cmsBinding/datasource 三分区补齐同一验收
 * （面板只 emit，不直改 node.animation/cmsBinding/datasource）。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { ElSelect } from 'element-plus'
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

describe('PropertyPanel 撤销时序（animation/cmsBinding/datasource 三分区，close-tech-debt-1 1.1-1.3）', () => {
  /** 按 placeholder 定位面板内某个 ElSelect（避免依赖渲染顺序） */
  function findSelect(wrapper: ReturnType<typeof mountPanel>, placeholder: string) {
    const c = wrapper.findAllComponents(ElSelect).find((s) => s.props('placeholder') === placeholder)
    expect(c).toBeDefined()
    return c!
  }

  it('animation 分区：选类型只 emit update:animation，不直改 node.animation', async () => {
    const node = makeNode()
    const wrapper = mountPanel(node)
    const typeSelect = findSelect(wrapper, '无动画')
    typeSelect.vm.$emit('update:model-value', 'fade')
    await nextTick()

    expect(wrapper.emitted('update:animation')).toEqual([['n1', 'type', 'fade']])
    expect(node.animation).toBeUndefined() // 未被直改
  })

  it('animation 分区：清除选择只 emit clear:animation，不直改 node.animation', async () => {
    const node = makeNode()
    node.animation = { type: 'fade', duration: 600 }
    const wrapper = mountPanel(node)
    const typeSelect = findSelect(wrapper, '无动画')
    // clearable 清空时 update:model-value 为空值 → 模板走 clearAnimation()
    typeSelect.vm.$emit('update:model-value', '')
    await nextTick()

    expect(wrapper.emitted('clear:animation')).toEqual([['n1']])
    expect(node.animation).toEqual({ type: 'fade', duration: 600 }) // 未被直改
  })

  it('cmsBinding 分区：v-model setter 只 emit update:cms-binding(key/value)，不直改 node.cmsBinding', async () => {
    const node = makeNode()
    const wrapper = mountPanel(node)
    const colSelect = findSelect(wrapper, '选择内容集合')
    colSelect.vm.$emit('update:model-value', 'col-1')
    await nextTick()

    expect(wrapper.emitted('update:cms-binding')).toEqual([['n1', 'collectionId', 'col-1']])
    expect(node.cmsBinding).toBeUndefined() // 未被直改（惰性初始化在父侧）
  })

  it('cmsBinding 分区：解绑按钮只 emit clear:cms-binding，不直改 node.cmsBinding', async () => {
    const node = makeNode()
    node.cmsBinding = { collectionId: 'col-1', mode: 'single' }
    const wrapper = mountPanel(node)
    const unbindBtn = wrapper.findAll('button').find((b) => b.text().includes('解绑'))
    expect(unbindBtn).toBeDefined()
    await unbindBtn!.trigger('click')

    expect(wrapper.emitted('clear:cms-binding')).toEqual([['n1']])
    expect(node.cmsBinding).toEqual({ collectionId: 'col-1', mode: 'single' }) // 未被直改
  })

  it('datasource 分区：选数据源只 emit update:datasource，不直改 node.datasource', async () => {
    const node = makeNode()
    const wrapper = mount(PropertyPanel, {
      props: { node, meta: makeMeta(), datasources: [{ id: 'ds-1', name: '静态源' }], collections: [] },
    })
    const dsSelect = findSelect(wrapper, '选择数据源')
    dsSelect.vm.$emit('update:model-value', 'ds-1')
    await nextTick()

    // varName 无现值 → 默认 'data'
    expect(wrapper.emitted('update:datasource')).toEqual([['n1', { id: 'ds-1', varName: 'data' }]])
    expect(node.datasource).toBeUndefined() // 未被直改
  })

  it('datasource 分区：清空选择 emit update:datasource null（解绑语义），不直改', async () => {
    const node = makeNode()
    node.datasource = { id: 'ds-1', varName: 'data' }
    const wrapper = mount(PropertyPanel, {
      props: { node, meta: makeMeta(), datasources: [{ id: 'ds-1', name: '静态源' }], collections: [] },
    })
    const dsSelect = findSelect(wrapper, '选择数据源')
    dsSelect.vm.$emit('update:model-value', '')
    await nextTick()

    expect(wrapper.emitted('update:datasource')).toEqual([['n1', null]])
    expect(node.datasource).toEqual({ id: 'ds-1', varName: 'data' }) // 未被直改
  })

  it('datasource 分区：改变量名只 emit 派生后的新值，不直改 node.datasource', async () => {
    const node = makeNode()
    node.datasource = { id: 'ds-1', varName: 'data' }
    const wrapper = mount(PropertyPanel, {
      props: { node, meta: makeMeta(), datasources: [{ id: 'ds-1', name: '静态源' }], collections: [] },
    })
    const input = wrapper.find('input[placeholder="变量名（默认 data）"]')
    expect(input.exists()).toBe(true)
    await input.setValue('items')

    expect(wrapper.emitted('update:datasource')).toEqual([['n1', { id: 'ds-1', varName: 'items' }]])
    expect(node.datasource).toEqual({ id: 'ds-1', varName: 'data' }) // 未被直改
  })
})
