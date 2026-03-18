import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanText from '../../src/lib/content/LubanText.vue';

describe('LubanText', () => {
  it('renders text content', () => {
    const wrapper = mount(LubanText, {
      props: { content: 'Hello' },
    });
    expect(wrapper.text()).toContain('Hello');
  });
});

