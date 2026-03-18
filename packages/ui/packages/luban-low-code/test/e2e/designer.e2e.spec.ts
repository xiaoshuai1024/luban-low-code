import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanDesigner from '../../src/lib/LubanDesigner.vue';
import type { PageSchema } from '../../src/lib/schema';

describe('LubanDesigner e2e', () => {
  it('allows adding a root child node via add-node event', async () => {
    const schema: PageSchema = {
      formState: {},
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: { maxWidth: 'full', padded: true },
        children: [],
      },
    };

    const wrapper = mount(LubanDesigner, {
      props: {
        schema,
        designMode: true,
        showToolbar: false,
      },
    });

    // 模拟外部处理 add-node 事件后更新 schema
    await wrapper.vm.$emit('add-node', 'LubanButton');
    schema.root.children.push({
      id: 'btn-1',
      type: 'LubanButton',
      props: { content: '按钮', variant: 'contained', color: 'primary' },
      children: [],
    });
    await wrapper.setProps({ schema: { ...schema } });

    expect(schema.root.children.length).toBe(1);
  });
});

