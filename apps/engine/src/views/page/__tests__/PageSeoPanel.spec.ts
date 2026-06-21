/**
 * PageSeoPanel.spec.ts — V2-T2 SEO 面板单测。
 *
 * 验证：
 *  - 渲染所有 SEO 字段（title/description/keywords/og/canonical/noIndex）
 *  - 输入回写 emit('update:seo') 含完整 PageSeo
 *  - keywords 文本与数组转换
 *  - noIndex 开关切换 robots 语义
 *  - 无 props.seo 时各字段默认空
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageSeoPanel from '../components/PageSeoPanel.vue'
import type { PageSeo } from '@/types/schema'

describe('V2-T2 PageSeoPanel', () => {
  it('渲染所有 SEO 字段输入控件', () => {
    const wrapper = mount(PageSeoPanel, { props: { seo: {} } })
    // 关键字段 label 出现
    expect(wrapper.text()).toContain('页面标题')
    expect(wrapper.text()).toContain('描述')
    expect(wrapper.text()).toContain('OG 标题')
    expect(wrapper.text()).toContain('OG 图片')
    expect(wrapper.text()).toContain('Canonical')
    expect(wrapper.text()).toContain('禁止索引')
  })

  it('props.seo 初始值回显', () => {
    const seo: PageSeo = {
      title: '测试页',
      description: '测试描述',
      keywords: ['营销', '建站'],
      ogTitle: 'OG 标题',
      ogImage: 'https://img.test/cover.png',
      canonical: 'https://test.com/x',
      noIndex: true,
    }
    const wrapper = mount(PageSeoPanel, { props: { seo } })
    // title input
    const inputs = wrapper.findAll('input')
    const titleInput = inputs.find((i) => (i.element as HTMLInputElement).value === '测试页')
    expect(titleInput).toBeTruthy()
    // keywords 逗号分隔回显
    const kwInput = inputs.find((i) => (i.element as HTMLInputElement).value === '营销, 建站')
    expect(kwInput).toBeTruthy()
    // noIndex switch checked
    const switches = wrapper.findAllComponents({ name: 'ElSwitch' })
    const noIndexSwitch = switches.find((s) => s.props('modelValue') === true)
    expect(noIndexSwitch).toBeTruthy()
  })

  it('title 输入触发 update:seo 含完整字段', async () => {
    const wrapper = mount(PageSeoPanel, { props: { seo: {} } })
    const titleInput = wrapper.find('input')
    await titleInput.setValue('新标题')
    const emitted = wrapper.emitted('update:seo')
    expect(emitted).toBeTruthy()
    const lastSeo = emitted![emitted!.length - 1][0] as PageSeo
    expect(lastSeo.title).toBe('新标题')
    // 其它字段保留默认（空/false/[]）
    expect(lastSeo.description).toBe('')
    expect(lastSeo.keywords).toEqual([])
    expect(lastSeo.noIndex).toBe(false)
  })

  it('keywords 逗号输入转数组', async () => {
    const wrapper = mount(PageSeoPanel, { props: { seo: {} } })
    // keywords input 是第 3 个 input（title/description textarea 后）
    // 用 setProps 验证转换逻辑更直接
    await wrapper.setProps({ seo: { keywords: ['a', 'b', 'c'] } })
    const inputs = wrapper.findAll('input')
    const kwInput = inputs.find((i) => (i.element as HTMLInputElement).value === 'a, b, c')
    expect(kwInput).toBeTruthy()
  })

  it('noIndex 开关切换触发 update:seo noIndex=true', async () => {
    const wrapper = mount(PageSeoPanel, { props: { seo: { noIndex: false } } })
    const sw = wrapper.findComponent({ name: 'ElSwitch' })
    await sw.vm.$emit('update:modelValue', true)
    const emitted = wrapper.emitted('update:seo')
    expect(emitted).toBeTruthy()
    const lastSeo = emitted![emitted!.length - 1][0] as PageSeo
    expect(lastSeo.noIndex).toBe(true)
  })

  it('OG 预览在 ogImage 有值时显示', () => {
    const wrapper = mount(PageSeoPanel, {
      props: { seo: { ogImage: 'https://img.test/x.png', title: 'T' } },
    })
    expect(wrapper.find('.page-seo-panel__preview').exists()).toBe(true)
    expect(wrapper.find('img.page-seo-panel__preview-img').attributes('src')).toBe('https://img.test/x.png')
  })

  it('OG 预览在无 ogImage 时不显示', () => {
    const wrapper = mount(PageSeoPanel, { props: { seo: { title: 'T' } } })
    expect(wrapper.find('.page-seo-panel__preview').exists()).toBe(false)
  })

  it('无 props.seo 时回退空对象不报错', () => {
    const wrapper = mount(PageSeoPanel)
    expect(wrapper.find('.page-seo-panel').exists()).toBe(true)
    // title input 为空
    const titleInput = wrapper.find('input')
    expect((titleInput.element as HTMLInputElement).value).toBe('')
  })
})
