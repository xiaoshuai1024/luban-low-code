import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanTestimonialCarousel from '../../src/lib/marketing/LubanTestimonialCarousel.vue';

describe('LubanTestimonialCarousel（客户评价轮播）', () => {
  const testimonials = [
    { quote: '第一条评价', author: '张三', role: 'CTO', rating: 5 },
    { quote: '第二条评价', author: '李四', avatarUrl: 'https://example.com/p.jpg' },
  ];

  afterEach(() => {
    vi.useRealTimers();
  });

  it('默认渲染：空列表不渲染轮播主体', () => {
    const wrapper = mount(LubanTestimonialCarousel);
    expect(wrapper.find('.lb-testimonial-carousel__slide').exists()).toBe(false);
  });

  it('渲染首条评价（引用/作者/头衔/星级）', () => {
    const wrapper = mount(LubanTestimonialCarousel, {
      props: { testimonials: [testimonials[0]] },
    });
    expect(wrapper.find('.lb-testimonial-carousel__quote').text()).toBe('第一条评价');
    expect(wrapper.find('.lb-testimonial-carousel__name').text()).toBe('张三');
    expect(wrapper.find('.lb-testimonial-carousel__role').text()).toBe('CTO');
    expect(wrapper.findAll('.lb-testimonial-carousel__star--on').length).toBe(5);
  });

  it('头像与头衔仅在提供时渲染', () => {
    const wrapper = mount(LubanTestimonialCarousel, {
      props: { testimonials: [testimonials[1]] },
    });
    expect(wrapper.find('.lb-testimonial-carousel__avatar').attributes('src')).toBe('https://example.com/p.jpg');
    expect(wrapper.find('.lb-testimonial-carousel__role').exists()).toBe(false);
    expect(wrapper.find('.lb-testimonial-carousel__rating').exists()).toBe(false);
  });

  it('圆点数量等于评价数，当前项高亮；点击圆点切换', async () => {
    const wrapper = mount(LubanTestimonialCarousel, {
      props: { testimonials, autoplay: false },
    });
    const dots = wrapper.findAll('.lb-testimonial-carousel__dot');
    expect(dots.length).toBe(2);
    expect(dots[0].classes()).toContain('lb-testimonial-carousel__dot--on');

    await dots[1].trigger('click');
    expect(wrapper.find('.lb-testimonial-carousel__quote').text()).toBe('第二条评价');
    expect(dots[1].classes()).toContain('lb-testimonial-carousel__dot--on');
    expect(dots[0].classes()).not.toContain('lb-testimonial-carousel__dot--on');
  });

  it('autoplay 按间隔自动切换（fake timers）', async () => {
    vi.useFakeTimers();
    const wrapper = mount(LubanTestimonialCarousel, {
      props: { testimonials, autoplay: true, interval: 100 },
    });
    expect(wrapper.find('.lb-testimonial-carousel__quote').text()).toBe('第一条评价');

    await vi.advanceTimersByTimeAsync(100);
    expect(wrapper.find('.lb-testimonial-carousel__quote').text()).toBe('第二条评价');

    // 到末尾后再前进一个间隔，循环回第一条
    await vi.advanceTimersByTimeAsync(100);
    expect(wrapper.find('.lb-testimonial-carousel__quote').text()).toBe('第一条评价');
  });

  it('卸载时清理自动播放定时器', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const wrapper = mount(LubanTestimonialCarousel, {
      props: { testimonials, autoplay: true, interval: 100 },
    });
    wrapper.unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
