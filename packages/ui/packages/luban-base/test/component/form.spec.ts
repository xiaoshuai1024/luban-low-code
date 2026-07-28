import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanForm from '../../src/lib/form/LubanForm.vue';
import LubanInput from '../../src/lib/form/LubanInput.vue';
import LubanButton from '../../src/lib/button/LubanButton.vue';

describe('LubanForm e2e', () => {
  it('submits with nested LubanInput and LubanButton', async () => {
    const onSubmit = vi.fn();
    const wrapper = mount(LubanForm, {
      props: { onSubmit },
      slots: {
        default: `
          <LubanInput
            label="姓名"
            name="name"
            data-test="name-input"
          />
          <LubanButton type="submit" content="提交" />
        `,
      },
      global: {
        components: { LubanInput, LubanButton },
      },
    });

    const input = wrapper.get('[data-test="name-input"] input');
    await input.setValue('Alice');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')).toBeTruthy();
  });
});

