import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanGallery from '../../src/lib/marketing/LubanGallery.vue';

describe('LubanGallery（图库网格）', () => {
  const images = [
    { src: 'https://example.com/1.jpg', alt: '案例一', caption: '官网首页' },
    { src: 'https://example.com/2.jpg', alt: '案例二' },
  ];

  it('默认渲染：空 images 不渲染网格', () => {
    const wrapper = mount(LubanGallery);
    expect(wrapper.find('.lb-gallery__grid').exists()).toBe(false);
  });

  it('渲染全部图片与 alt', () => {
    const wrapper = mount(LubanGallery, { props: { images } });
    expect(wrapper.findAll('.lb-gallery__item').length).toBe(2);
    const imgs = wrapper.findAll('.lb-gallery__img');
    expect(imgs[0].attributes('src')).toBe('https://example.com/1.jpg');
    expect(imgs[0].attributes('alt')).toBe('案例一');
    expect(imgs[1].attributes('alt')).toBe('案例二');
  });

  it('caption 仅在提供时渲染', () => {
    const wrapper = mount(LubanGallery, { props: { images } });
    const captions = wrapper.findAll('.lb-gallery__caption');
    expect(captions.length).toBe(1);
    expect(captions[0].text()).toBe('官网首页');
  });

  it('columns/gap 透传为网格内联样式', () => {
    const wrapper = mount(LubanGallery, {
      props: { images, columns: 4, gap: '24px' },
    });
    const style = wrapper.find('.lb-gallery__grid').attributes('style') ?? '';
    expect(style).toContain('repeat(4, 1fr)');
    expect(style).toContain('gap: 24px');
  });

  it('backgroundColor 透传为区块内联样式', () => {
    const wrapper = mount(LubanGallery, {
      props: { images, backgroundColor: '#fafafa' },
    });
    expect(wrapper.find('.lb-gallery').attributes('style')).toContain('background-color');
  });
});
