import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanRow from '../../src/lib/layout/LubanRow.vue';
import LubanCol from '../../src/lib/layout/LubanCol.vue';

describe('LubanRow & LubanCol', () => {
  it('renders two columns', () => {
    const wrapper = mount(LubanRow, {
      props: { gap: 12 },
      slots: {
        default: `
          <LubanCol :basis="50" />
          <LubanCol :basis="50" />
        `,
      },
      global: {
        components: { LubanCol },
      },
    });
    expect(wrapper.findAllComponents(LubanCol)).toHaveLength(2);
  });
});

