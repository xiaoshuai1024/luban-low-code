import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanLogoCloud from '../../src/lib/marketing/LubanLogoCloud.vue';

describe('LubanLogoCloud（客户 Logo 墙）', () => {
  const logos = [
    { src: 'https://example.com/a.png', alt: '公司A', url: 'https://a.example.com' },
    { src: 'https://example.com/b.png', alt: '公司B' },
  ];

  it('默认渲染：默认标题 + 空列表不渲染 Logo 区', () => {
    const wrapper = mount(LubanLogoCloud);
    expect(wrapper.find('.lb-logo-cloud__heading').text()).toBe('他们都在使用');
    expect(wrapper.find('.lb-logo-cloud__list').exists()).toBe(false);
  });

  it('渲染全部 Logo 与 alt', () => {
    const wrapper = mount(LubanLogoCloud, { props: { logos } });
    expect(wrapper.findAll('.lb-logo-cloud__item').length).toBe(2);
    const imgs = wrapper.findAll('.lb-logo-cloud__img');
    expect(imgs[0].attributes('src')).toBe('https://example.com/a.png');
    expect(imgs[0].attributes('alt')).toBe('公司A');
  });

  it('url 提供时锚点跳转对应地址，否则回退 #', () => {
    const wrapper = mount(LubanLogoCloud, { props: { logos } });
    const items = wrapper.findAll('.lb-logo-cloud__item');
    expect(items[0].attributes('href')).toBe('https://a.example.com');
    expect(items[1].attributes('href')).toBe('#');
  });

  it('grayscale 默认开启置灰，关闭后移除置灰类', () => {
    const gray = mount(LubanLogoCloud, { props: { logos } });
    expect(gray.find('.lb-logo-cloud__img--gray').exists()).toBe(true);

    const color = mount(LubanLogoCloud, { props: { logos, grayscale: false } });
    expect(color.find('.lb-logo-cloud__img--gray').exists()).toBe(false);
  });

  it('空标题时隐藏 heading', () => {
    const wrapper = mount(LubanLogoCloud, { props: { logos, heading: '' } });
    expect(wrapper.find('.lb-logo-cloud__heading').exists()).toBe(false);
  });
});
