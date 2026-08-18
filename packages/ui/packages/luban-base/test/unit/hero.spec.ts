import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanHero from '../../src/lib/content/LubanHero.vue';

describe('LubanHero（动效升级版）', () => {
  it('渲染极光装饰层（光球 + 网格底纹）', () => {
    const wrapper = mount(LubanHero, { props: { title: '你好' } });
    expect(wrapper.find('.lb-hero__aurora').exists()).toBe(true);
    expect(wrapper.findAll('.lb-hero__orb').length).toBe(3);
    expect(wrapper.find('.lb-hero__grid').exists()).toBe(true);
  });

  it('背景图模式隐藏极光装饰层（避免与图片叠加）', () => {
    const wrapper = mount(LubanHero, {
      props: { title: '你好', backgroundImage: 'https://example.com/bg.jpg' },
    });
    expect(wrapper.find('.lb-hero__aurora').exists()).toBe(false);
    expect(wrapper.find('.lb-hero__overlay').exists()).toBe(true);
  });

  it('眉标渲染为呼吸徽章（含脉冲圆点）', () => {
    const wrapper = mount(LubanHero, {
      props: { title: '你好', eyebrow: '开源 · MIT' },
    });
    expect(wrapper.find('.lb-hero__eyebrow').text()).toContain('开源 · MIT');
    expect(wrapper.find('.lb-hero__pulse').exists()).toBe(true);
  });

  it('主 CTA 带箭头且 href 生效', () => {
    const wrapper = mount(LubanHero, {
      props: { title: '你好', ctaText: '开始使用', ctaUrl: 'https://example.com' },
    });
    const cta = wrapper.get('.lb-hero__cta');
    expect(cta.attributes('href')).toBe('https://example.com');
    expect(cta.find('.lb-hero__cta-arrow').exists()).toBe(true);
  });

  it('split 布局渲染右侧图', () => {
    const wrapper = mount(LubanHero, {
      props: { title: '你好', layout: 'split', sideImage: 'https://example.com/x.png' },
    });
    expect(wrapper.find('.lb-hero__side-image').exists()).toBe(true);
  });
});
