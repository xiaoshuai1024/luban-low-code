/**
 * LubanTabs 物料单测（navigation/tabs）。
 *
 * 覆盖：props schema 契约、组件渲染（标签列表、active 高亮、type 变体 class）、
 * change 事件触发与 payload。
 *
 * @since 1.0.0
 */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { tabsMaterial } from '../../src/materials/navigation/tabs/material';
import LubanTabs from '../../src/materials/navigation/tabs/LubanTabs.vue';

describe('tabsMaterial (LubanTabs) — props schema contract', () => {
  it('declares identity fields correctly', () => {
    expect(tabsMaterial.name).toBe('LubanTabs');
    expect(tabsMaterial.version).toBe('1.0.0');
    expect(tabsMaterial.category).toBe('navigation');
  });

  it('declares all required props with defaults', () => {
    const props = tabsMaterial.propsSchema.properties;
    for (const key of ['tabs', 'activeKey', 'type']) {
      expect(props[key]).toBeDefined();
      expect(props[key]!.default).not.toBeUndefined();
    }
  });

  it('type is enum ["","card","border-card"] default ""', () => {
    const t = tabsMaterial.propsSchema.properties.type;
    expect(t!.enum).toEqual(['', 'card', 'border-card']);
    expect(t!.default).toBe('');
  });

  it('tabs is array of { label, key }', () => {
    const tabs = tabsMaterial.propsSchema.properties.tabs;
    expect(tabs!.type).toBe('array');
    expect(tabs!.items?.properties?.label.type).toBe('string');
    expect(tabs!.items?.properties?.key.type).toBe('string');
  });

  it('declares change event and default slot', () => {
    expect(tabsMaterial.events!.map((e) => e.name)).toContain('change');
    expect(tabsMaterial.slots!.map((s) => s.name)).toContain('default');
  });
});

describe('LubanTabs component — rendering', () => {
  const tabs = [
    { label: '详情', key: 'detail' },
    { label: '评论', key: 'comment' },
  ];

  it('renders all tab buttons', () => {
    const wrapper = mount(LubanTabs, { props: { tabs } });
    const tabBtns = wrapper.findAll('.lb-tabs__tab');
    expect(tabBtns).toHaveLength(2);
    expect(tabBtns[0].text()).toBe('详情');
  });

  it('uses line variant class when type="" (default)', () => {
    const wrapper = mount(LubanTabs, { props: { tabs } });
    expect(wrapper.find('.lb-tabs').classes()).toContain('lb-tabs--line');
  });

  it('uses card variant class when type="card"', () => {
    const wrapper = mount(LubanTabs, { props: { tabs, type: 'card' } });
    expect(wrapper.find('.lb-tabs').classes()).toContain('lb-tabs--card');
  });

  it('uses border-card variant class when type="border-card"', () => {
    const wrapper = mount(LubanTabs, {
      props: { tabs, type: 'border-card' },
    });
    expect(wrapper.find('.lb-tabs').classes()).toContain('lb-tabs--border-card');
  });

  it('highlights active tab via activeKey', () => {
    const wrapper = mount(LubanTabs, { props: { tabs, activeKey: 'comment' } });
    const active = wrapper.findAll('.lb-tabs__tab--active');
    expect(active).toHaveLength(1);
    expect(active[0].text()).toBe('评论');
  });

  it('sets aria-selected on the active tab', () => {
    const wrapper = mount(LubanTabs, { props: { tabs, activeKey: 'detail' } });
    const tabBtns = wrapper.findAll('.lb-tabs__tab');
    expect(tabBtns[0].attributes('aria-selected')).toBe('true');
    expect(tabBtns[1].attributes('aria-selected')).toBe('false');
  });

  it('emits change with key on tab click', async () => {
    let lastKey: unknown = undefined;
    const wrapper = mount(LubanTabs, {
      props: { tabs, onChange: (k: string) => (lastKey = k) },
    });
    await wrapper.findAll('.lb-tabs__tab')[1].trigger('click');
    expect(lastKey).toBe('comment');
  });

  it('renders default slot content in panel', () => {
    const wrapper = mount(LubanTabs, {
      props: { tabs },
      slots: { default: '<div class="panel-body">内容</div>' },
    });
    expect(wrapper.find('.panel-body').exists()).toBe(true);
  });
});
