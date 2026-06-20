/**
 * LubanModal 物料单测（feedback/modal）。
 *
 * 覆盖：props schema 契约、组件渲染（visible 控制、标题、宽度、teleport）、
 * open/close/update:visible 事件触发、mask 点击与关闭按钮。
 *
 * @since 1.0.0
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { modalMaterial } from '../../src/materials/feedback/modal/material';
import LubanModal from '../../src/materials/feedback/modal/LubanModal.vue';

// LubanModal 用 <teleport to="body"> 渲染，内容脱离 wrapper 根树，
// 故 visible=true 的断言需查 document.body；每个用例后清理 body 防泄漏。
afterEach(() => {
  document.body.innerHTML = '';
});

describe('modalMaterial (LubanModal) — props schema contract', () => {
  it('declares identity fields correctly', () => {
    expect(modalMaterial.name).toBe('LubanModal');
    expect(modalMaterial.version).toBe('1.0.0');
    expect(modalMaterial.category).toBe('feedback');
  });

  it('declares all required props with defaults', () => {
    const props = modalMaterial.propsSchema.properties;
    for (const key of ['title', 'visible', 'width']) {
      expect(props[key]).toBeDefined();
      expect(props[key]!.default).not.toBeUndefined();
    }
    expect(props.title.default).toBe('');
    expect(props.visible.default).toBe(false);
    expect(props.width.default).toBe('50%');
  });

  it('declares open/close/update:visible events and default+footer slots', () => {
    const events = modalMaterial.events!.map((e) => e.name);
    expect(events).toContain('open');
    expect(events).toContain('close');
    expect(events).toContain('update:visible');
    const slots = modalMaterial.slots!.map((s) => s.name);
    expect(slots).toContain('default');
    expect(slots).toContain('footer');
  });
});

describe('LubanModal component — rendering & events', () => {
  it('does not render modal when visible=false', () => {
    mount(LubanModal, { props: { visible: false } });
    expect(document.body.querySelector('.lb-modal')).toBeNull();
  });

  it('renders modal when visible=true with title', () => {
    mount(LubanModal, {
      props: { visible: true, title: '提示' },
    });
    const el = document.body.querySelector('.lb-modal');
    expect(el).not.toBeNull();
    expect(document.body.querySelector('.lb-modal__title')!.textContent).toBe(
      '提示'
    );
  });

  it('applies width style', () => {
    mount(LubanModal, {
      props: { visible: true, width: '480px' },
    });
    const el = document.body.querySelector('.lb-modal') as HTMLElement;
    expect(el.getAttribute('style')).toContain('width: 480px');
  });

  it('emits open when visible transitions false→true', async () => {
    const events: string[] = [];
    const wrapper = mount(LubanModal, {
      props: {
        visible: false,
        onOpen: () => events.push('open'),
        onClose: () => events.push('close'),
      },
    });
    await wrapper.setProps({ visible: true });
    expect(events).toContain('open');
    expect(events).not.toContain('close');
  });

  it('emits close when visible transitions true→false', async () => {
    const events: string[] = [];
    const wrapper = mount(LubanModal, {
      props: {
        visible: true,
        onClose: () => events.push('close'),
      },
    });
    await wrapper.setProps({ visible: false });
    expect(events).toContain('close');
  });

  it('emits update:visible=false and close button click', async () => {
    let lastEmitted: unknown = undefined;
    const wrapper = mount(LubanModal, {
      props: {
        visible: true,
        'onUpdate:visible': (v: boolean) => {
          lastEmitted = v;
        },
      },
    });
    const closeBtn = document.body.querySelector(
      '.lb-modal__close'
    ) as HTMLElement;
    closeBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(lastEmitted).toBe(false);
  });

  it('emits update:visible=false on mask click', async () => {
    let lastEmitted: unknown = undefined;
    const wrapper = mount(LubanModal, {
      props: {
        visible: true,
        'onUpdate:visible': (v: boolean) => {
          lastEmitted = v;
        },
      },
    });
    const mask = document.body.querySelector(
      '.lb-modal__mask'
    ) as HTMLElement;
    mask.dispatchEvent(new Event('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(lastEmitted).toBe(false);
  });

  it('does not close when clicking inside the panel (stop propagation)', async () => {
    let lastEmitted: unknown = 'untouched';
    const wrapper = mount(LubanModal, {
      props: {
        visible: true,
        'onUpdate:visible': (v: boolean) => {
          lastEmitted = v;
        },
      },
    });
    const panel = document.body.querySelector('.lb-modal') as HTMLElement;
    panel.dispatchEvent(new Event('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(lastEmitted).toBe('untouched');
  });

  it('emits update:visible=false on ESC keydown (a11y)', async () => {
    let lastEmitted: unknown = undefined;
    const wrapper = mount(LubanModal, {
      props: {
        visible: true,
        'onUpdate:visible': (v: boolean) => {
          lastEmitted = v;
        },
      },
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(lastEmitted).toBe(false);
  });

  it('renders footer slot when provided', () => {
    mount(LubanModal, {
      props: { visible: true },
      slots: { footer: '<button class="ok">确定</button>' },
    });
    expect(document.body.querySelector('.lb-modal__footer')).not.toBeNull();
    expect(document.body.querySelector('.ok')).not.toBeNull();
  });
});
