import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanForm from '../../src/lib/form/LubanForm.vue';

describe('LubanForm', () => {
  it('emits submit event', async () => {
    const onSubmit = vi.fn();
    const wrapper = mount(LubanForm, {
      props: { size: 'medium', onSubmit },
      slots: { default: '<button type="submit">提交</button>' },
    });
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeTruthy();
  });
});

