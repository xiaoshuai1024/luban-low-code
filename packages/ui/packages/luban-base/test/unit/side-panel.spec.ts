import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanSidePanel from '../../src/lib/layout/LubanSidePanel.vue';

describe('LubanSidePanel', () => {
  it('renders title and body, closes on click', async () => {
    const wrapper = mount(LubanSidePanel, {
      props: {
        modelValue: true,
        title: 'Panel Title',
        size: 'small',
      },
      slots: {
        body: '<div class="body-slot">Body</div>',
      },
    });
    expect(wrapper.find('.lb-side-panel__title').text()).toBe('Panel Title');
    expect(wrapper.find('.body-slot').exists()).toBe(true);

    await wrapper.get('.lb-side-panel__close').trigger('click');
    const update = wrapper.emitted('update:modelValue');
    expect(update?.[0]?.[0]).toBe(false);
  });
});

