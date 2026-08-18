import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanPricing from '../../src/lib/marketing/LubanPricing.vue';

describe('LubanPricing（套餐定价卡片）', () => {
  const plans = [
    {
      name: '免费版',
      price: '¥0',
      features: [
        { text: '1 个站点', included: true },
        { text: '自定义域名', included: false },
      ],
    },
    {
      name: '专业版',
      price: '¥99',
      period: '月',
      ctaText: '立即升级',
      ctaUrl: 'https://example.com/buy',
    },
  ];

  it('默认渲染：默认标题 + 空套餐不渲染列表', () => {
    const wrapper = mount(LubanPricing);
    expect(wrapper.find('.lb-pricing__heading').text()).toBe('选择方案');
    expect(wrapper.find('.lb-pricing__list').exists()).toBe(false);
  });

  it('渲染套餐名/价格/周期', () => {
    const wrapper = mount(LubanPricing, { props: { plans } });
    const planCards = wrapper.findAll('.lb-pricing__plan');
    expect(planCards.length).toBe(2);
    expect(wrapper.findAll('.lb-pricing__name')[0].text()).toBe('免费版');
    expect(wrapper.findAll('.lb-pricing__price')[1].text()).toContain('¥99');
    expect(wrapper.find('.lb-pricing__period').text()).toBe('/月');
    expect(wrapper.findAll('.lb-pricing__period').length).toBe(1); // 无周期的套餐不渲染
  });

  it('功能列表渲染 included/on 与 off 样式', () => {
    const wrapper = mount(LubanPricing, { props: { plans } });
    const features = wrapper.findAll('.lb-pricing__feature');
    expect(features.length).toBe(2);
    expect(features[0].text()).toBe('1 个站点');
    expect(features[0].classes()).not.toContain('lb-pricing__feature--off');
    expect(features[1].classes()).toContain('lb-pricing__feature--off');
  });

  it('highlightIndex 高亮对应套餐', () => {
    const wrapper = mount(LubanPricing, { props: { plans, highlightIndex: 1 } });
    const planCards = wrapper.findAll('.lb-pricing__plan');
    expect(planCards[0].classes()).not.toContain('lb-pricing__plan--highlight');
    expect(planCards[1].classes()).toContain('lb-pricing__plan--highlight');
  });

  it('ctaText 提供时渲染 CTA 链接，未提供不渲染', () => {
    const wrapper = mount(LubanPricing, { props: { plans } });
    const ctas = wrapper.findAll('.lb-pricing__cta');
    expect(ctas.length).toBe(1);
    expect(ctas[0].text()).toBe('立即升级');
    expect(ctas[0].attributes('href')).toBe('https://example.com/buy');
  });

  it('空标题时隐藏 heading', () => {
    const wrapper = mount(LubanPricing, { props: { plans, heading: '' } });
    expect(wrapper.find('.lb-pricing__heading').exists()).toBe(false);
  });
});
