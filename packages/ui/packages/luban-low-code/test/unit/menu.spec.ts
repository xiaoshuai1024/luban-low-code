/**
 * LubanMenu 物料单测（navigation/menu）。
 *
 * 覆盖：
 *  1. propsSchema 契约（字段、类型、默认值、enum）；
 *  2. defineMaterial 身份字段；
 *  3. 组件渲染（横向/纵向、子菜单、active 高亮）；
 *  4. select 事件触发与 payload（含子菜单 stop 冒泡）。
 *
 * @since 1.0.0
 */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { menuMaterial } from '../../src/materials/navigation/menu/material';
import LubanMenu from '../../src/materials/navigation/menu/LubanMenu.vue';

describe('menuMaterial (LubanMenu) — props schema contract', () => {
  it('declares identity fields correctly', () => {
    expect(menuMaterial.name).toBe('LubanMenu');
    expect(menuMaterial.version).toBe('1.0.0');
    expect(menuMaterial.category).toBe('navigation');
  });

  it('declares all required props with defaults', () => {
    const props = menuMaterial.propsSchema.properties;
    for (const key of ['items', 'mode', 'activeKey']) {
      expect(props[key]).toBeDefined();
      expect(props[key]!.default).not.toBeUndefined();
    }
  });

  it('mode is enum horizontal|vertical default horizontal', () => {
    const mode = menuMaterial.propsSchema.properties.mode;
    expect(mode!.enum).toEqual(['horizontal', 'vertical']);
    expect(mode!.default).toBe('horizontal');
  });

  it('items is array of { label, key, children? }', () => {
    const items = menuMaterial.propsSchema.properties.items;
    expect(items!.type).toBe('array');
    expect(items!.items?.properties?.label.type).toBe('string');
    expect(items!.items?.properties?.key.type).toBe('string');
    expect(items!.items?.properties?.children).toBeDefined();
  });

  it('activeKey default empty string', () => {
    expect(menuMaterial.propsSchema.properties.activeKey.default).toBe('');
  });

  it('declares select event', () => {
    expect(menuMaterial.events!.map((e) => e.name)).toContain('select');
  });
});

describe('LubanMenu component — rendering', () => {
  const items = [
    { label: '首页', key: 'home' },
    {
      label: '设置',
      key: 'settings',
      children: [
        { label: '账户', key: 'account' },
        { label: '安全', key: 'security' },
      ],
    },
  ];

  it('renders horizontal mode by default', () => {
    const wrapper = mount(LubanMenu, { props: { items } });
    expect(wrapper.find('.lb-menu').classes()).toContain('lb-menu--horizontal');
  });

  it('renders vertical mode when mode=vertical', () => {
    const wrapper = mount(LubanMenu, { props: { items, mode: 'vertical' } });
    expect(wrapper.find('.lb-menu').classes()).toContain('lb-menu--vertical');
  });

  it('renders top-level item labels', () => {
    const wrapper = mount(LubanMenu, { props: { items } });
    const labels = wrapper.findAll('.lb-menu__label').map((n) => n.text());
    expect(labels).toContain('首页');
    expect(labels).toContain('设置');
  });

  it('renders submenu children', () => {
    const wrapper = mount(LubanMenu, { props: { items } });
    const subitems = wrapper.findAll('.lb-menu__subitem');
    expect(subitems).toHaveLength(2);
    expect(subitems[0].text()).toBe('账户');
  });

  it('highlights active item via activeKey', () => {
    const wrapper = mount(LubanMenu, { props: { items, activeKey: 'home' } });
    const activeItems = wrapper.findAll('.lb-menu__item--active');
    expect(activeItems).toHaveLength(1);
    expect(activeItems[0].text()).toContain('首页');
  });

  it('emits select with key on item click', async () => {
    let lastKey: unknown = undefined;
    const wrapper = mount(LubanMenu, {
      props: { items, onSelect: (k: string) => (lastKey = k) },
    });
    const topItems = wrapper.findAll('.lb-menu__item');
    // click the label span inside first item
    await topItems[0].find('.lb-menu__label').trigger('click');
    expect(lastKey).toBe('home');
  });

  it('emits select with child key and stops propagation to parent', async () => {
    const keys: string[] = [];
    const wrapper = mount(LubanMenu, {
      props: { items, onSelect: (k: string) => keys.push(k) },
    });
    const subitem = wrapper.findAll('.lb-menu__subitem')[0];
    await subitem.trigger('click');
    expect(keys).toContain('account');
    // 子菜单 click stop 冒泡，父项 key 不应再次出现（select 仅触发一次）
    expect(keys.length).toBe(1);
  });
});
