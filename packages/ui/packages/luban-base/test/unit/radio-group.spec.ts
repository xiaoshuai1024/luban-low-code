import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanRadioGroup from '../../src/lib/form/LubanRadioGroup.vue';

describe('LubanRadioGroup', () => {
  it('emits update:modelValue on change', async () => {
    const wrapper = mount(LubanRadioGroup, {
      props: {
        modelValue: null,
        label: '单选',
        name: 'field',
        options: [
          { label: '1', value: 1 },
          { label: '2', value: 2 },
        ],
      },
    });
    const radios = wrapper.findAll('input[type="radio"]');
    await radios[1].setValue(true);
    const update = wrapper.emitted('update:modelValue');
    expect(update).toBeTruthy();
  });
});

