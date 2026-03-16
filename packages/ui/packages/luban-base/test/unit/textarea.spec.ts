import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanTextArea from '../../src/lib/form/LubanTextArea.vue';

describe('LubanTextArea', () => {
  it('emits update:modelValue on input', async () => {
    const wrapper = mount(LubanTextArea, {
      props: {
        modelValue: '',
        label: '多行文本',
        name: 'field',
      },
    });
    const textarea = wrapper.get('textarea');
    await textarea.setValue('multi');
    const update = wrapper.emitted('update:modelValue');
    expect(update).toBeTruthy();
    expect(update?.[0]?.[0]).toBe('multi');
  });
});

