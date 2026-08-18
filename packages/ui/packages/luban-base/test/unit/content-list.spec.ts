import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanContentList from '../../src/lib/content/LubanContentList.vue';

describe('LubanContentList（CMS 内容列表）', () => {
  const items = [
    { title: '第一篇', body: '正文一', image: 'https://example.com/a.jpg', link: 'https://example.com/1' },
    { title: '第二篇', body: '正文二' },
  ];

  it('默认渲染：空 items 显示空状态文案', () => {
    const wrapper = mount(LubanContentList);
    expect(wrapper.find('.lb-content-list__empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('暂无内容');
    expect(wrapper.find('.lb-content-list__grid').exists()).toBe(false);
  });

  it('渲染全部卡片（标题/正文/图片）', () => {
    const wrapper = mount(LubanContentList, { props: { items } });
    expect(wrapper.findAll('.lb-content-list__card').length).toBe(2);
    expect(wrapper.text()).toContain('第一篇');
    expect(wrapper.text()).toContain('正文二');
    expect(wrapper.findAll('.lb-content-list__img').length).toBe(1);
    expect(wrapper.find('.lb-content-list__img').attributes('src')).toBe('https://example.com/a.jpg');
    expect(wrapper.find('.lb-content-list__img').attributes('alt')).toBe('第一篇');
  });

  it('有 link 的卡片渲染为 <a>，无 link 渲染为 <div>', () => {
    const wrapper = mount(LubanContentList, { props: { items } });
    const cards = wrapper.findAll('.lb-content-list__card');
    expect(cards[0].element.tagName).toBe('A');
    expect(cards[0].attributes('href')).toBe('https://example.com/1');
    expect(cards[1].element.tagName).toBe('DIV');
  });

  it('自定义字段映射（titleKey/bodyKey/imageKey/linkKey）', () => {
    const wrapper = mount(LubanContentList, {
      props: {
        items: [{ name: '映射标题', desc: '映射正文', cover: 'https://example.com/c.jpg', url: 'https://example.com/x' }],
        titleKey: 'name',
        bodyKey: 'desc',
        imageKey: 'cover',
        linkKey: 'url',
      },
    });
    expect(wrapper.text()).toContain('映射标题');
    expect(wrapper.text()).toContain('映射正文');
    expect(wrapper.find('.lb-content-list__img').attributes('src')).toBe('https://example.com/c.jpg');
    expect(wrapper.find('.lb-content-list__card').attributes('href')).toBe('https://example.com/x');
  });

  it('columns 透传为网格 CSS 变量', () => {
    const wrapper = mount(LubanContentList, { props: { items, columns: 2 } });
    expect(wrapper.find('.lb-content-list__grid').attributes('style')).toContain('--lb-cl-cols: 2');
  });

  it('空状态文案可配置', () => {
    const wrapper = mount(LubanContentList, { props: { emptyText: '暂无文章' } });
    expect(wrapper.text()).toContain('暂无文章');
  });
});
