import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LubanSteps from '../../src/materials/content/steps/LubanSteps.vue';

describe('LubanSteps', () => {
  const items = [
    { title: 'Step 1', description: 'First step' },
    { title: 'Step 2', description: 'Second step' },
    { title: 'Step 3' },
  ];

  it('renders all steps', () => {
    const wrapper = mount(LubanSteps, { props: { items } });
    const steps = wrapper.findAll('.lb-steps__item');
    expect(steps.length).toBe(3);
    expect(wrapper.text()).toContain('Step 1');
    expect(wrapper.text()).toContain('Second step');
  });

  it('marks current step active', () => {
    const wrapper = mount(LubanSteps, { props: { items, current: 1 } });
    const active = wrapper.find('.lb-steps__item--active');
    expect(active.exists()).toBe(true);
    expect(active.text()).toContain('Step 2');
  });

  it('marks done steps', () => {
    const wrapper = mount(LubanSteps, { props: { items, current: 2 } });
    expect(wrapper.findAll('.lb-steps__item--done').length).toBe(2);
  });

  it('applies vertical direction class', () => {
    const wrapper = mount(LubanSteps, { props: { items, direction: 'vertical' } });
    expect(wrapper.classes()).toContain('lb-steps--vertical');
  });

  it('renders empty without items', () => {
    const wrapper = mount(LubanSteps, { props: { items: [] } });
    expect(wrapper.findAll('.lb-steps__item').length).toBe(0);
  });
});
