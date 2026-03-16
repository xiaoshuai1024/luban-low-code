import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanButton from '../../src/lib/button/LubanButton.vue';

describe('LubanButton', () => {
  it('renders content and variant classes', () => {
    const wrapper = mount(LubanButton, {
      props: { content: 'Test', variant: 'contained', color: 'primary' },
    });
    const btn = wrapper.get('button');
    expect(btn.text()).toContain('Test');
    expect(btn.classes()).toContain('lb-button--contained');
    expect(btn.classes()).toContain('lb-button--primary');
  });
});

