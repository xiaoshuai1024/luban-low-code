import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanPage from '../../src/lib/LubanPage.vue';
import type { PageSchema } from '../../src/lib/schema';

describe('RuntimeRenderer 节点属性透传', () => {
  it('把 node.id 输出为 DOM id 与 data-lb-node（锚点导航定位分区）', () => {
    const schema: PageSchema = {
      root: {
        id: 'features',
        type: 'LubanText',
        props: { content: '特性分区' },
      },
    };
    const wrapper = mount(LubanPage, { props: { schema } });
    const el = wrapper.find('[data-lb-node="features"]');
    expect(el.exists()).toBe(true);
    expect(el.attributes('id')).toBe('features');
  });

  it('嵌套子节点同样输出 id（多分区页面各节点可独立定位）', () => {
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        children: [
          { id: 'hero', type: 'LubanText', props: { content: 'Hero' } },
          { id: 'footer', type: 'LubanText', props: { content: 'Footer' } },
        ],
      },
    };
    const wrapper = mount(LubanPage, { props: { schema } });
    expect(wrapper.find('#hero').exists()).toBe(true);
    expect(wrapper.find('#footer').exists()).toBe(true);
  });
});
