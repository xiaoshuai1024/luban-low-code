import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

describe('App', () => {
  it('renders designer page with palette and drop zone', async () => {
    const wrapper = mount(App);
    // 根容器存在
    expect(wrapper.find('[data-cy=\"designer-root\"]').exists()).toBe(true);
    // 左侧组件面板存在
    expect(wrapper.find('[data-cy=\"designer-palette\"]').exists()).toBe(true);
    // 画布 drop 区存在
    expect(wrapper.find('[data-cy=\"designer-drop-zone\"]').exists()).toBe(true);
  });
});
