import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanDesigner from '../../src/lib/LubanDesigner.vue';
import type { PageSchema } from '../../src/lib/schema';

describe('LubanDesigner', () => {
  it('renders root container in design mode', () => {
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

    expect(wrapper.find('.luban-designer__root-container').exists()).toBe(true);
  });
});

