import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanCodeBlock from '../../src/materials/data-display/code-block/LubanCodeBlock.vue';

describe('LubanCodeBlock', () => {
  it('renders code content', () => {
    const wrapper = mount(LubanCodeBlock, { props: { code: 'const x = 1;', language: 'javascript' } });
    expect(wrapper.text()).toContain('const x');
    expect(wrapper.find('.hljs').exists()).toBe(true);
  });

  it('renders empty without error', () => {
    const wrapper = mount(LubanCodeBlock, { props: { code: '' } });
    expect(wrapper.find('.lb-code-block__pre').exists()).toBe(true);
  });

  it('shows copy button by default', () => {
    const wrapper = mount(LubanCodeBlock, { props: { code: 'x' } });
    expect(wrapper.find('.lb-code-block__copy').exists()).toBe(true);
  });

  it('hides copy button when showCopy=false', () => {
    const wrapper = mount(LubanCodeBlock, { props: { code: 'x', showCopy: false } });
    expect(wrapper.find('.lb-code-block__copy').exists()).toBe(false);
  });

  it('applies collapsed class', () => {
    const wrapper = mount(LubanCodeBlock, { props: { code: 'x', collapsed: true } });
    expect(wrapper.classes()).toContain('lb-code-block--collapsed');
  });
});
