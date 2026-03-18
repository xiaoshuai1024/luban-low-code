import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanCheckbox from '../../src/lib/form/LubanCheckbox.vue';

describe('LubanCheckbox', () => {
  it('emits update:modelValue on toggle', async () => {
    const wrapper = mount(LubanCheckbox, {
      props: {
        modelValue: false,
        label: '复选框',
        name: 'field',
      },
    });
    const input = wrapper.get('input[type="checkbox"]');
    await input.setValue(true);
    const update = wrapper.emitted('update:modelValue');
    expect(update).toBeTruthy();
  });
});

