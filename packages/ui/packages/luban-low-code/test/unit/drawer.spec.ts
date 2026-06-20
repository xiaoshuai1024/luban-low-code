/**
 * LubanDrawer 物料单测（feedback/drawer）。
 *
 * 覆盖：props schema 契约、组件渲染（visible/placement/size、teleport）、
 * open/close/update:visible 事件、mask 与面板内点击。
 *
 * @since 1.0.0
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { drawerMaterial } from '../../src/materials/feedback/drawer/material';
import LubanDrawer from '../../src/materials/feedback/drawer/LubanDrawer.vue';

// LubanDrawer 用 <teleport to="body"> 渲染，内容脱离 wrapper 根树，
// 故 visible=true 的断言需查 document.body；每个用例后清理 body 防泄漏。
afterEach(() => {
  document.body.innerHTML = '';
});

describe('drawerMaterial (LubanDrawer) — props schema contract', () => {
  it('declares identity fields correctly', () => {
    expect(drawerMaterial.name).toBe('LubanDrawer');
    expect(drawerMaterial.version).toBe('1.0.0');
    expect(drawerMaterial.category).toBe('feedback');
  });

  it('declares all required props with defaults', () => {
    const props = drawerMaterial.propsSchema.properties;
    for (const key of ['title', 'visible', 'placement', 'size']) {
      expect(props[key]).toBeDefined();
      expect(props[key]!.default).not.toBeUndefined();
    }
    expect(props.placement.default).toBe('right');
    expect(props.size.default).toBe('30%');
  });

  it('placement is enum left|right|top|bottom', () => {
    expect(drawerMaterial.propsSchema.properties.placement.enum).toEqual([
      'left',
      'right',
      'top',
      'bottom',
    ]);
  });

  it('declares open/close/update:visible events and default slot', () => {
    const events = drawerMaterial.events!.map((e) => e.name);
    expect(events).toContain('open');
    expect(events).toContain('close');
    expect(events).toContain('update:visible');
    expect(drawerMaterial.slots!.map((s) => s.name)).toContain('default');
  });
});

describe('LubanDrawer component — rendering & events', () => {
  it('does not render when visible=false', () => {
    mount(LubanDrawer, { props: { visible: false } });
    expect(document.body.querySelector('.lb-drawer')).toBeNull();
  });

  it('renders drawer when visible=true with title', () => {
    mount(LubanDrawer, {
      props: { visible: true, title: '筛选' },
    });
    expect(document.body.querySelector('.lb-drawer')).not.toBeNull();
    expect(document.body.querySelector('.lb-drawer__title')!.textContent).toBe(
      '筛选'
    );
  });

  it('applies right placement class and size as width by default', () => {
    mount(LubanDrawer, {
      props: { visible: true, placement: 'right', size: '320px' },
    });
    const panel = document.body.querySelector('.lb-drawer') as HTMLElement;
    expect(panel.classList.contains('lb-drawer--right')).toBe(true);
    expect(panel.getAttribute('style')).toContain('width: 320px');
  });

  it('applies top placement class and size as height', () => {
    mount(LubanDrawer, {
      props: { visible: true, placement: 'top', size: '200px' },
    });
    const panel = document.body.querySelector('.lb-drawer') as HTMLElement;
    expect(panel.classList.contains('lb-drawer--top')).toBe(true);
    expect(panel.getAttribute('style')).toContain('height: 200px');
  });

  it('emits open when visible transitions false→true', async () => {
    const events: string[] = [];
    const wrapper = mount(LubanDrawer, {
      props: {
        visible: false,
        onOpen: () => events.push('open'),
        onClose: () => events.push('close'),
      },
    });
    await wrapper.setProps({ visible: true });
    expect(events).toContain('open');
  });

  it('emits close when visible transitions true→false', async () => {
    const events: string[] = [];
    const wrapper = mount(LubanDrawer, {
      props: { visible: true, onClose: () => events.push('close') },
    });
    await wrapper.setProps({ visible: false });
    expect(events).toContain('close');
  });

  it('emits update:visible=false on close button click', async () => {
    let lastEmitted: unknown = undefined;
    const wrapper = mount(LubanDrawer, {
      props: {
        visible: true,
        'onUpdate:visible': (v: boolean) => {
          lastEmitted = v;
        },
      },
    });
    const closeBtn = document.body.querySelector(
      '.lb-drawer__close'
    ) as HTMLElement;
    closeBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(lastEmitted).toBe(false);
  });

  it('emits update:visible=false on mask click', async () => {
    let lastEmitted: unknown = undefined;
    const wrapper = mount(LubanDrawer, {
      props: {
        visible: true,
        'onUpdate:visible': (v: boolean) => {
          lastEmitted = v;
        },
      },
    });
    const mask = document.body.querySelector(
      '.lb-drawer__mask'
    ) as HTMLElement;
    mask.dispatchEvent(new Event('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(lastEmitted).toBe(false);
  });

  it('does not close when clicking inside the panel', async () => {
    let lastEmitted: unknown = 'untouched';
    const wrapper = mount(LubanDrawer, {
      props: {
        visible: true,
        'onUpdate:visible': (v: boolean) => {
          lastEmitted = v;
        },
      },
    });
    const panel = document.body.querySelector('.lb-drawer') as HTMLElement;
    panel.dispatchEvent(new Event('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(lastEmitted).toBe('untouched');
  });
});
