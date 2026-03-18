import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanInput from '../../src/lib/form/LubanInput.vue';

describe('LubanInput', () => {
  it('works with v-model', async () => {
    const wrapper = mount(LubanInput, {
      props: {
        modelValue: '',
        label: '输入框',
        name: 'field',
      },
    });
    const input = wrapper.get('input');
    await input.setValue('hello');
    const update = wrapper.emitted('update:modelValue');
    expect(update).toBeTruthy();
    expect(update?.[0]?.[0]).toBe('hello');
  });
});

