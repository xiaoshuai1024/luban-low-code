import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanNavbar from '../../src/lib/marketing/LubanNavbar.vue';

describe('LubanNavbar（品牌 logo + 下划线动效版）', () => {
  const links = [
    { label: '特性', url: '#features' },
    { label: 'GitHub', url: 'https://github.com' },
  ];

  it('渲染品牌名与 logo 方块', () => {
    const wrapper = mount(LubanNavbar, { props: { brand: 'Luban 鲁班' } });
    expect(wrapper.text()).toContain('Luban 鲁班');
    expect(wrapper.find('.lb-navbar__logo').exists()).toBe(true);
  });

  it('渲染导航链接与 href', () => {
    const wrapper = mount(LubanNavbar, { props: { links } });
    const els = wrapper.findAll('.lb-navbar__link');
    expect(els.length).toBe(2);
    expect(els[0].attributes('href')).toBe('#features');
  });

  it('sticky 开关控制定位 class', () => {
    const sticky = mount(LubanNavbar, { props: { sticky: true } });
    const notSticky = mount(LubanNavbar, { props: { sticky: false } });
    expect(sticky.find('.lb-navbar--sticky').exists()).toBe(true);
    expect(notSticky.find('.lb-navbar--sticky').exists()).toBe(false);
  });
});
