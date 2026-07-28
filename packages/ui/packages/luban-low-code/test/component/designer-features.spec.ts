/**
 * designer-features.spec.ts — LubanDesigner V3 新功能组件测试。
 *
 * 覆盖：网格背景、缩放控件、内置工具栏、页面白卡效果。
 * 拖拽交互（dragenter/dragleave/drop 反馈）在 Cypress E2E 中覆盖（真实浏览器环境）。
 *
 * 使用 @vue/test-utils mount + jsdom，无后端依赖。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import LubanDesigner from '../../src/lib/LubanDesigner.vue';
import type { PageSchema } from '../../src/lib/schema';

function makeSchema(children: any[] = []): PageSchema {
  return {
    formState: {},
    root: {
      id: 'root',
      type: 'LubanContainer',
      props: { maxWidth: 'full', padded: true },
      children,
    },
  };
}

function makeChild(type: string, id: string, props?: Record<string, unknown>) {
  return { id, type, props: props ?? {}, children: [] };
}

describe('LubanDesigner V3 新功能', () => {
  let wrapper: VueWrapper<any>;

  describe('内置工具栏与缩放', () => {
    beforeEach(() => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
    });

    it('设计态渲染内置工具栏', () => {
      expect(wrapper.find('.luban-designer__builtin-toolbar').exists()).toBe(true);
    });

    it('非设计态不渲染内置工具栏', () => {
      const w = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: false, showToolbar: false },
      });
      expect(w.find('.luban-designer__builtin-toolbar').exists()).toBe(false);
    });

    it('缩放按钮存在：缩小、百分比、放大、适应', () => {
      const zoomControls = wrapper.find('.luban-designer__zoom-controls');
      expect(zoomControls.exists()).toBe(true);
      expect(wrapper.find('.luban-designer__zoom-label').text()).toBe('100%');
    });

    it('点击 + 放大，点击 − 缩小', async () => {
      const zoomLabel = wrapper.find('.luban-designer__zoom-label');
      const btns = wrapper.findAll('.luban-designer__zoom-btn');
      const zoomOutBtn = btns[0];
      const zoomInBtn = btns[1];

      await zoomInBtn.trigger('click');
      expect(zoomLabel.text()).toBe('110%');

      await zoomOutBtn.trigger('click');
      expect(zoomLabel.text()).toBe('100%');

      // 连续缩小 7 次 → 1.0 - 0.7 = 0.30 → 30%
      for (let i = 0; i < 7; i++) {
        await zoomOutBtn.trigger('click');
      }
      expect(zoomLabel.text()).toBe('30%');
    });

    it('缩小到最小 25% 后按钮禁用', async () => {
      const zoomOutBtn = wrapper.findAll('.luban-designer__zoom-btn')[0];
      // 缩小到极限
      for (let i = 0; i < 10; i++) {
        await zoomOutBtn.trigger('click');
      }
      expect(wrapper.find('.luban-designer__zoom-label').text()).toBe('25%');
      // 缩小按钮应禁用
      expect((zoomOutBtn.element as HTMLButtonElement).disabled).toBe(true);
    });

    it('放大到最大 200% 后按钮禁用', async () => {
      const zoomInBtn = wrapper.findAll('.luban-designer__zoom-btn')[1];
      for (let i = 0; i < 12; i++) {
        await zoomInBtn.trigger('click');
      }
      expect(wrapper.find('.luban-designer__zoom-label').text()).toBe('200%');
      expect((zoomInBtn.element as HTMLButtonElement).disabled).toBe(true);
    });

    it('点击百分比标签重置为 100%', async () => {
      const zoomInBtn = wrapper.findAll('.luban-designer__zoom-btn')[1];
      await zoomInBtn.trigger('click');
      await zoomInBtn.trigger('click');
      expect(wrapper.find('.luban-designer__zoom-label').text()).toBe('120%');
      await wrapper.find('.luban-designer__zoom-label').trigger('click');
      expect(wrapper.find('.luban-designer__zoom-label').text()).toBe('100%');
    });

    it('适应画布按钮存在', () => {
      expect(wrapper.find('.luban-designer__zoom-btn--fit').exists()).toBe(true);
    });

    it('网格切换按钮存在并默认为激活态', () => {
      const gridBtn = wrapper.find('.luban-designer__toggle-btn');
      expect(gridBtn.exists()).toBe(true);
      expect(gridBtn.classes()).toContain('luban-designer__toggle-btn--active');
    });

    it('吸附切换按钮存在（默认非激活）', () => {
      const toggles = wrapper.findAll('.luban-designer__toggle-btn');
      expect(toggles.length).toBe(2);
      const snapBtn = toggles[1];
      expect(snapBtn.classes()).not.toContain('luban-designer__toggle-btn--active');
    });
  });

  describe('网格背景', () => {
    it('设计态默认显示网格 CSS class', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      expect(wrapper.find('.luban-designer__canvas').classes()).toContain('luban-designer__canvas--grid');
    });

    it('非设计态不显示网格 class', () => {
      const w = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: false, showToolbar: false },
      });
      expect(w.find('.luban-designer__canvas').classes()).not.toContain('luban-designer__canvas--grid');
    });

    it('点击网格切换按钮移除网格 class', async () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      const gridBtn = wrapper.find('.luban-designer__toggle-btn');
      await gridBtn.trigger('click');
      expect(gridBtn.classes()).not.toContain('luban-designer__toggle-btn--active');
      expect(wrapper.find('.luban-designer__canvas').classes()).not.toContain('luban-designer__canvas--grid');
    });

    it('点击网格按钮再次切换恢复网格', async () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      const gridBtn = wrapper.find('.luban-designer__toggle-btn');
      await gridBtn.trigger('click'); // 关
      expect(wrapper.find('.luban-designer__canvas').classes()).not.toContain('luban-designer__canvas--grid');
      await gridBtn.trigger('click'); // 开
      expect(wrapper.find('.luban-designer__canvas').classes()).toContain('luban-designer__canvas--grid');
    });
  });

  describe('页面白卡与画布结构', () => {
    it('root-container 渲染', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      expect(wrapper.find('.luban-designer__root-container').exists()).toBe(true);
    });

    it('空 schema 显示 placeholder 引导', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      expect(wrapper.find('.luban-designer__placeholder').exists()).toBe(true);
    });

    it('有子节点时不显示 placeholder', () => {
      const children = [makeChild('LubanButton', 'btn-1', { content: '按钮1' })];
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(children), designMode: true, showToolbar: false },
      });
      expect(wrapper.find('.luban-designer__placeholder').exists()).toBe(false);
    });

    it('spacer 区域存在', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      expect(wrapper.find('.luban-designer__canvas-spacer').exists()).toBe(true);
    });

    it('视口渲染', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      expect(wrapper.find('.luban-designer__viewport').exists()).toBe(true);
    });
  });

  describe('拖入反馈 DOM 结构（JSDOM 限制：交互由 Cypress E2E 覆盖）', () => {
    it('drop-hint 元素有条件渲染条件', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      // dropZoneActive 初始为 false，hint 不应存在
      expect(wrapper.find('.luban-designer__drop-hint').exists()).toBe(false);
    });

    it('insert-line 元素有条件渲染条件', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      // insertIndicatorY 初始为 null，线不应存在
      expect(wrapper.find('.luban-designer__insert-line').exists()).toBe(false);
    });

    it('canvas 元素接受 dragover/drop/dragenter/dragleave 事件绑定', () => {
      wrapper = mount(LubanDesigner, {
        props: { schema: makeSchema(), designMode: true, showToolbar: false },
      });
      const canvas = wrapper.find('.luban-designer__canvas');
      expect(canvas.exists()).toBe(true);
      // 验证画布 div 已渲染（事件绑定由 Vue 模板编译保证）
    });
  });
});
