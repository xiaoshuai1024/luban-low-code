import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanMarkdown from '../../src/materials/content/markdown/LubanMarkdown.vue';

describe('LubanMarkdown', () => {
  it('renders plain text', () => {
    const wrapper = mount(LubanMarkdown, { props: { content: 'Hello' } });
    expect(wrapper.html()).toContain('<p>Hello</p>');
  });

  it('renders headings', () => {
    const wrapper = mount(LubanMarkdown, { props: { content: '# Title' } });
    expect(wrapper.html()).toContain('<h1>Title</h1>');
  });

  it('renders code blocks', () => {
    const wrapper = mount(LubanMarkdown, { props: { content: '```js\nconst x = 1;\n```' } });
    // hljs class on pre, text contains code
    expect(wrapper.find('.hljs').exists()).toBe(true);
    expect(wrapper.text()).toContain('const x');
  });

  it('renders empty without error', () => {
    const wrapper = mount(LubanMarkdown, { props: { content: '' } });
    expect(wrapper.html()).not.toContain('<p>');
  });

  it('applies theme class', () => {
    const wrapper = mount(LubanMarkdown, { props: { content: 'x', theme: 'vuepress' } });
    expect(wrapper.classes()).toContain('luban-markdown--vuepress');
  });
});
