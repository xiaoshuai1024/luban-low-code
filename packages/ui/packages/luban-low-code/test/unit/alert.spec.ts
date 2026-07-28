import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanAlert from '../../src/materials/feedback/alert/LubanAlert.vue';

describe('LubanAlert', () => {
  it('renders content', () => {
    const wrapper = mount(LubanAlert, { props: { content: 'test message' } });
    expect(wrapper.text()).toContain('test message');
  });

  it('renders title when provided', () => {
    const wrapper = mount(LubanAlert, { props: { title: 'Notice', content: 'msg' } });
    expect(wrapper.text()).toContain('Notice');
    expect(wrapper.text()).toContain('msg');
  });

  it('applies type class', () => {
    const wrapper = mount(LubanAlert, { props: { content: 'x', type: 'error' } });
    expect(wrapper.classes()).toContain('lb-alert--error');
  });

  it('shows close button when closable', () => {
    const wrapper = mount(LubanAlert, { props: { content: 'x', closable: true } });
    expect(wrapper.find('.lb-alert__close').exists()).toBe(true);
  });

  it('hides after close click', async () => {
    const wrapper = mount(LubanAlert, { props: { content: 'x', closable: true } });
    await wrapper.find('.lb-alert__close').trigger('click');
    expect(wrapper.find('.lb-alert').exists()).toBe(false);
  });
});
