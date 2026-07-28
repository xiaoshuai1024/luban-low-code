/**
 * LubanToast 物料单测（feedback/toast）。
 *
 * 覆盖：props schema 契约（含 events 为空）、组件渲染（按 type 渲染样式、
 * message 展示）、命令式 show/hide 行为与自动消失计时。
 *
 * @since 1.0.0
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { toastMaterial } from '../../src/materials/feedback/toast/material';
import LubanToast from '../../src/materials/feedback/toast/LubanToast.vue';

describe('toastMaterial (LubanToast) — props schema contract', () => {
  it('declares identity fields correctly', () => {
    expect(toastMaterial.name).toBe('LubanToast');
    expect(toastMaterial.version).toBe('1.0.0');
    expect(toastMaterial.category).toBe('feedback');
  });

  it('declares all required props with defaults', () => {
    const props = toastMaterial.propsSchema.properties;
    for (const key of ['message', 'type', 'duration']) {
      expect(props[key]).toBeDefined();
      expect(props[key]!.default).not.toBeUndefined();
    }
    expect(props.message.default).toBe('');
    expect(props.type.default).toBe('info');
    expect(props.duration.default).toBe(3000);
  });

  it('type is enum success|warning|info|error', () => {
    expect(toastMaterial.propsSchema.properties.type.enum).toEqual([
      'success',
      'warning',
      'info',
      'error',
    ]);
  });

  it('declares no events (command-style, not declarative)', () => {
    expect(toastMaterial.events).toEqual([]);
  });
});

describe('LubanToast component — rendering', () => {
  it('renders nothing when message is empty and not shown', () => {
    const wrapper = mount(LubanToast, { props: { message: '' } });
    expect(wrapper.find('.lb-toast').exists()).toBe(false);
  });

  it('renders toast with message in material-state preview', () => {
    const wrapper = mount(LubanToast, {
      props: { message: '保存成功', type: 'success' },
    });
    expect(wrapper.find('.lb-toast').exists()).toBe(true);
    expect(wrapper.find('.lb-toast__message').text()).toBe('保存成功');
    expect(wrapper.find('.lb-toast').classes()).toContain('lb-toast--success');
  });

  it('applies type class for each type variant', () => {
    for (const t of ['info', 'warning', 'error'] as const) {
      const wrapper = mount(LubanToast, { props: { message: 'x', type: t } });
      expect(wrapper.find('.lb-toast').classes()).toContain(`lb-toast--${t}`);
    }
  });
});

describe('LubanToast component — imperative show/hide', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('show() displays the toast with given message', async () => {
    const wrapper = mount(LubanToast, { props: { message: '' } });
    // message 为空时初始不渲染；调用 show 后渲染
    expect(wrapper.find('.lb-toast').exists()).toBe(false);
    (wrapper.vm as unknown as { show: (m: string) => void }).show('提示一下');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.lb-toast').exists()).toBe(true);
    expect(wrapper.find('.lb-toast__message').text()).toBe('提示一下');
  });

  it('auto-hides after duration ms via setTimeout', async () => {
    vi.useFakeTimers();
    const wrapper = mount(LubanToast, {
      props: { message: '', duration: 1000 },
    });
    (wrapper.vm as unknown as { show: (m: string) => void }).show('稍后消失');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.lb-toast').exists()).toBe(true);
    vi.advanceTimersByTime(1000);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.lb-toast').exists()).toBe(false);
  });

  it('hide() clears the toast immediately', async () => {
    const wrapper = mount(LubanToast, { props: { message: '可见' } });
    expect(wrapper.find('.lb-toast').exists()).toBe(true);
    (wrapper.vm as unknown as { hide: () => void }).hide();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.lb-toast').exists()).toBe(false);
  });
});
