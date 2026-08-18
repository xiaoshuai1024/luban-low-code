import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanFeatureGrid from '../../src/lib/marketing/LubanFeatureGrid.vue';

describe('LubanFeatureGrid（渐变图标配色版）', () => {
  const features = [
    { icon: '🎨', title: '可视化搭建', description: '拖拽即所得' },
    { icon: '⚡', title: 'SSR 就绪' },
    { icon: '🤖', title: 'AI 生成' },
    { icon: '📊', title: '数据驱动' },
    { icon: '🌐', title: '多端适配' },
    { icon: '📚', title: '75+ 组件' },
  ];

  it('渲染全部卡片与标题', () => {
    const wrapper = mount(LubanFeatureGrid, { props: { features } });
    expect(wrapper.findAll('.lb-feature-grid__card').length).toBe(6);
    expect(wrapper.text()).toContain('可视化搭建');
    expect(wrapper.text()).toContain('拖拽即所得');
  });

  it('标题渲染渐变下划线装饰', () => {
    const wrapper = mount(LubanFeatureGrid, {
      props: { features, heading: '核心特性' },
    });
    const h = wrapper.get('.lb-feature-grid__heading');
    expect(h.text()).toBe('核心特性');
  });

  it('图标配色类按索引循环（0..4 五色）', () => {
    const wrapper = mount(LubanFeatureGrid, { props: { features } });
    for (const idx of [0, 1, 2, 3, 4]) {
      expect(wrapper.find(`.lb-feature-grid__card--${idx}`).exists()).toBe(true);
    }
    // 第 6 张卡循环回 0
    expect(wrapper.findAll('.lb-feature-grid__card--0').length).toBe(2);
  });

  it('无 icon 卡片不渲染图标芯片（向后兼容）', () => {
    const wrapper = mount(LubanFeatureGrid, {
      props: { features: [{ title: '纯文字' }] },
    });
    expect(wrapper.find('.lb-feature-grid__icon').exists()).toBe(false);
  });
});
