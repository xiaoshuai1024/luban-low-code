import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanSelect from '../../src/lib/form/LubanSelect.vue';

describe('LubanSelect', () => {
  it('emits update:modelValue on change', async () => {
    const wrapper = mount(LubanSelect, {
      props: {
        modelValue: null,
        label: '选择',
        name: 'field',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
    });
    const select = wrapper.get('select');
    await select.setValue('b');
    const update = wrapper.emitted('update:modelValue');
    expect(update).toBeTruthy();
    expect(update?.[0]?.[0]).toBe('b');
  });
});

