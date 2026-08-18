import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanTestimonial from '../../src/lib/content/LubanTestimonial.vue';

describe('LubanTestimonial（客户评价卡片）', () => {
  it('渲染引用文案与作者信息', () => {
    const wrapper = mount(LubanTestimonial, {
      props: { quote: '非常好用', author: '张三', role: '产品经理' },
    });
    expect(wrapper.find('.lb-testimonial__quote').text()).toContain('非常好用');
    expect(wrapper.find('.lb-testimonial__author-name').text()).toBe('张三');
    expect(wrapper.find('.lb-testimonial__author-role').text()).toBe('产品经理');
  });

  it('默认 rating=0 不渲染星级', () => {
    const wrapper = mount(LubanTestimonial, { props: { quote: 'x' } });
    expect(wrapper.find('.lb-testimonial__stars').exists()).toBe(false);
  });

  it('rating 渲染对应数量的高亮星（共 5 颗）', () => {
    const wrapper = mount(LubanTestimonial, {
      props: { quote: 'x', rating: 4 },
    });
    const stars = wrapper.findAll('.lb-testimonial__star');
    expect(stars.length).toBe(5);
    expect(wrapper.findAll('.lb-testimonial__star--active').length).toBe(4);
    expect(wrapper.find('.lb-testimonial__stars').attributes('aria-label')).toBe('评分 4 / 5');
  });

  it('rating 越界夹紧到 [0,5] 并向下取整', () => {
    const over = mount(LubanTestimonial, { props: { quote: 'x', rating: 9 } });
    expect(over.findAll('.lb-testimonial__star--active').length).toBe(5);

    const under = mount(LubanTestimonial, { props: { quote: 'x', rating: -2 } });
    expect(under.findAll('.lb-testimonial__star--active').length).toBe(0);

    const frac = mount(LubanTestimonial, { props: { quote: 'x', rating: 3.7 } });
    expect(frac.findAll('.lb-testimonial__star--active').length).toBe(3);
  });

  it('avatarUrl 提供时渲染头像，否则不渲染', () => {
    const withAvatar = mount(LubanTestimonial, {
      props: { quote: 'x', author: '李四', avatarUrl: 'https://example.com/p.jpg' },
    });
    expect(withAvatar.find('.lb-testimonial__avatar').attributes('src')).toBe('https://example.com/p.jpg');

    const noAvatar = mount(LubanTestimonial, { props: { quote: 'x' } });
    expect(noAvatar.find('.lb-testimonial__avatar').exists()).toBe(false);
  });

  it('backgroundColor 透传为容器内联样式', () => {
    const wrapper = mount(LubanTestimonial, {
      props: { quote: 'x', backgroundColor: '#f5f5f5' },
    });
    expect(wrapper.find('.lb-testimonial').attributes('style')).toContain('background-color: rgb(245, 245, 245)');
  });
});
