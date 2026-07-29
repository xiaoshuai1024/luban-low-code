import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanContainer from '../../src/lib/layout/LubanContainer.vue';

describe('LubanContainer', () => {
  it('applies maxWidth and padded props', () => {
    const wrapper = mount(LubanContainer, {
      props: { maxWidth: 'lg', padded: true },
      slots: { default: '<div class="inner">content</div>' },
    });
    const el = wrapper.get('.lb-container');
    expect(el.classes()).toContain('lb-container--max-width-lg');
    expect(el.classes()).toContain('lb-container--padded');
    expect(wrapper.find('.inner').exists()).toBe(true);
  });
});

