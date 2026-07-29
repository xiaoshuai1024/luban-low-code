import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanSidePanel from '../../src/lib/layout/LubanSidePanel.vue';

describe('LubanSidePanel e2e', () => {
  it('shows body content and can be closed', async () => {
    const wrapper = mount(LubanSidePanel, {
      props: {
        modelValue: true,
        title: '配置',
      },
      slots: {
        body: '<div data-test="panel-body">Body Content</div>',
      },
    });

    expect(wrapper.find('[data-test=\"panel-body\"]').exists()).toBe(true);
    await wrapper.get('.lb-side-panel__close').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe(false);
  });
});

