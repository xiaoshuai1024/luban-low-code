import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanStats from '../../src/lib/marketing/LubanStats.vue';

describe('LubanStats（图标 + 渐变数值版）', () => {
  const stats = [
    { value: '75', suffix: '+', label: '开箱即用组件', icon: '🧩' },
    { value: 'Vue 3', label: '现代前端框架', icon: '⚡' },
    { value: 'MIT', label: '开源协议', icon: '🔓' },
    { value: 'SSR', label: '服务端渲染', icon: '🚀' },
  ];

  it('渲染全部统计项与后缀', () => {
    const wrapper = mount(LubanStats, { props: { stats } });
    expect(wrapper.findAll('.lb-stats__item').length).toBe(4);
    expect(wrapper.text()).toContain('75');
    expect(wrapper.text()).toContain('+');
    expect(wrapper.text()).toContain('开箱即用组件');
  });

  it('渲染统计图标芯片', () => {
    const wrapper = mount(LubanStats, { props: { stats } });
    expect(wrapper.findAll('.lb-stats__icon').length).toBe(4);
    expect(wrapper.find('.lb-stats__icon').text()).toBe('🧩');
  });

  it('配色按索引循环（0..3 四个渐变类）', () => {
    const wrapper = mount(LubanStats, { props: { stats } });
    expect(wrapper.find('.lb-stats__item--0').exists()).toBe(true);
    expect(wrapper.find('.lb-stats__item--3').exists()).toBe(true);
  });

  it('无 icon 时不渲染图标芯片（向后兼容旧 schema）', () => {
    const wrapper = mount(LubanStats, {
      props: { stats: [{ value: '1', label: 'x' }] },
    });
    expect(wrapper.find('.lb-stats__icon').exists()).toBe(false);
    expect(wrapper.text()).toContain('x');
  });
});
