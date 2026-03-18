import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanBanner from '../../src/lib/content/LubanBanner.vue';

describe('LubanBanner', () => {
  it('renders image with src', () => {
    const wrapper = mount(LubanBanner, {
      props: {
        src: 'https://via.placeholder.com/800x200?text=Banner',
        alt: '横幅',
      },
    });
    const img = wrapper.get('img');
    expect(img.attributes('src')).toContain('placeholder.com');
  });
});

