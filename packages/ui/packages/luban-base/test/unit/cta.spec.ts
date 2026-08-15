import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanCTA from '../../src/lib/content/LubanCTA.vue';

describe('LubanCTA（极光渐变面板版）', () => {
  it('渲染标题/描述/主次按钮', () => {
    const wrapper = mount(LubanCTA, {
      props: {
        heading: '准备开始了吗？',
        description: '2 分钟搭建第一个页面',
        buttonText: '进入控制台',
        buttonUrl: 'https://example.com',
        secondaryButtonText: 'GitHub',
        secondaryButtonUrl: 'https://github.com',
      },
    });
    expect(wrapper.text()).toContain('准备开始了吗？');
    expect(wrapper.text()).toContain('2 分钟搭建第一个页面');
    const primary = wrapper.get('.lb-cta__button--primary');
    expect(primary.attributes('href')).toBe('https://example.com');
    expect(wrapper.get('.lb-cta__button--secondary').attributes('href')).toBe('https://github.com');
  });

  it('按钮样式变体 class 正确', () => {
    const wrapper = mount(LubanCTA, {
      props: { heading: 'x', buttonText: 'go', buttonUrl: 'https://a.b', buttonVariant: 'outline' },
    });
    expect(wrapper.find('.lb-cta__button--outline').exists()).toBe(true);
  });

  it('极光面板渲染（样式由 ::before/::after 光球承载，不产生 DOM 断言依赖）', () => {
    const wrapper = mount(LubanCTA, { props: { heading: 'x' } });
    expect(wrapper.find('.lb-cta__content').exists()).toBe(true);
  });
});
