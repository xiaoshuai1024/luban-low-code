import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanSwitch from '../../src/lib/form/LubanSwitch.vue';

describe('LubanSwitch', () => {
  it('emits update:modelValue on toggle', async () => {
    const wrapper = mount(LubanSwitch, {
      props: {
        modelValue: false,
        label: '开关',
        name: 'field',
      },
    });
    const toggle = wrapper.get('button[role="switch"]');
    await toggle.trigger('click');
    const update = wrapper.emitted('update:modelValue');
    expect(update).toBeTruthy();
  });
});

