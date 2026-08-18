import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanFAQ from '../../src/lib/marketing/LubanFAQ.vue';

describe('LubanFAQ（常见问题折叠列表）', () => {
  const items = [
    { question: '是开源的吗？', answer: '是，MIT 协议。' },
    { question: '支持 SSR 吗？', answer: '支持。' },
    { question: '如何部署？', answer: 'Docker 一键部署。' },
  ];

  it('默认渲染：默认标题「常见问题」+ 空列表不渲染列表区', () => {
    const wrapper = mount(LubanFAQ);
    expect(wrapper.find('.lb-faq__heading').text()).toBe('常见问题');
    expect(wrapper.find('.lb-faq__list').exists()).toBe(false);
  });

  it('渲染全部问答项', () => {
    const wrapper = mount(LubanFAQ, { props: { items } });
    const details = wrapper.findAll('.lb-faq__item');
    expect(details.length).toBe(3);
    expect(wrapper.findAll('.lb-faq__question')[0].text()).toBe('是开源的吗？');
    expect(wrapper.findAll('.lb-faq__answer')[1].text()).toBe('支持。');
  });

  it('defaultOpenIndex 默认 -1：全部折叠', () => {
    const wrapper = mount(LubanFAQ, { props: { items } });
    const open = wrapper.findAll('.lb-faq__item').filter((d) => (d.element as HTMLDetailsElement).open);
    expect(open.length).toBe(0);
  });

  it('defaultOpenIndex 指定项默认展开', () => {
    const wrapper = mount(LubanFAQ, { props: { items, defaultOpenIndex: 1 } });
    const details = wrapper.findAll('.lb-faq__item');
    expect((details[1].element as HTMLDetailsElement).open).toBe(true);
    expect((details[0].element as HTMLDetailsElement).open).toBe(false);
  });

  it('自定义 heading 与空标题隐藏', () => {
    const custom = mount(LubanFAQ, { props: { items, heading: '部署相关' } });
    expect(custom.find('.lb-faq__heading').text()).toBe('部署相关');

    const none = mount(LubanFAQ, { props: { items, heading: '' } });
    expect(none.find('.lb-faq__heading').exists()).toBe(false);
  });
});
