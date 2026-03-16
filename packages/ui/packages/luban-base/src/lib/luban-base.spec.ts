import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanButton from './button/LubanButton.vue';

describe('luban-base', () => {
  it('LubanButton renders with content', () => {
    const wrapper = mount(LubanButton, {
      props: { content: 'Test', variant: 'contained', color: 'primary' },
    });
    expect(wrapper.text()).toContain('Test');
    expect(wrapper.find('button').classes()).toContain('lb-button--contained');
  });
});
