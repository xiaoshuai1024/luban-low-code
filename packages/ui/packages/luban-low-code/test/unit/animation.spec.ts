/**
 * V2-T5 动画系统单测。
 *
 * 覆盖：
 *  - buildAnimationCss：load/hover/in-view 三触发分支 + @keyframes 输出
 *  - isValidAnimation：type 必填校验
 *  - treeAnimationCss：整树遍历 + @keyframes 去重
 *  - 无动画节点零输出
 *  - duration/delay/easing 参数透传
 */
import { describe, it, expect } from 'vitest';
import {
  buildAnimationCss,
  treeAnimationCss,
  isValidAnimation,
} from '../../src/lib/animation';
import type { NodeSchema } from '../../src/lib/schema';

describe('V2-T5 isValidAnimation', () => {
  it('undefined 返回 false', () => {
    expect(isValidAnimation(undefined)).toBe(false);
  });

  it('无 type 返回 false', () => {
    expect(isValidAnimation({ duration: 500 })).toBe(false);
  });

  it('有合法 type 返回 true', () => {
    expect(isValidAnimation({ type: 'fade', duration: 500 })).toBe(true);
  });
});

describe('V2-T5 buildAnimationCss', () => {
  it('无效动画返回空串', () => {
    expect(buildAnimationCss('n1', undefined)).toBe('');
    expect(buildAnimationCss('n1', { duration: 500 })).toBe('');
  });

  it('load 触发：输出 @keyframes + 选择器 animation 规则', () => {
    const css = buildAnimationCss('n1', { type: 'fade', trigger: 'load' });
    expect(css).toContain('@keyframes lb-anim-fade');
    expect(css).toContain('[data-lb-node="n1"]');
    expect(css).toContain('animation:');
    expect(css).toContain('lb-anim-fade');
  });

  it('hover 触发：选择器加 :hover', () => {
    const css = buildAnimationCss('n2', { type: 'zoom', trigger: 'hover' });
    expect(css).toContain('[data-lb-node="n2"]:hover');
    expect(css).toContain('@keyframes lb-anim-zoom');
  });

  it('in-view 触发：输出 pending/playing class 规则', () => {
    const css = buildAnimationCss('n3', { type: 'slide-up', trigger: 'in-view' });
    expect(css).toContain('.lb-anim-pending');
    expect(css).toContain('.lb-anim-playing');
    expect(css).toContain('opacity: 0'); // pending 初始隐藏
  });

  it('duration/delay/easing 透传到 animation shorthand', () => {
    const css = buildAnimationCss('n4', {
      type: 'fade',
      duration: 1200,
      delay: 200,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      trigger: 'load',
    });
    expect(css).toContain('1200ms');
    expect(css).toContain('200ms');
    expect(css).toContain('cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('默认值：duration 600ms / delay 0 / easing ease-out / trigger load', () => {
    const css = buildAnimationCss('n5', { type: 'fade' });
    expect(css).toContain('600ms');
    expect(css).toContain('ease-out');
    // 默认 trigger=load，无 :hover 无 pending
    expect(css).not.toContain(':hover');
    expect(css).not.toContain('lb-anim-pending');
  });

  it('所有 5 种动画类型都有 @keyframes', () => {
    const types = ['fade', 'slide-up', 'slide-left', 'zoom', 'flip'] as const;
    for (const t of types) {
      const css = buildAnimationCss('n', { type: t });
      expect(css).toContain(`@keyframes lb-anim-${t}`);
    }
  });
});

describe('V2-T5 treeAnimationCss', () => {
  it('整树遍历收集动画 CSS', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [
        { id: 'c1', type: 'LubanText', animation: { type: 'fade', trigger: 'load' } },
        { id: 'c2', type: 'LubanText', animation: { type: 'zoom', trigger: 'hover' } },
      ],
    };
    const css = treeAnimationCss(root);
    expect(css).toContain('[data-lb-node="c1"]');
    expect(css).toContain('[data-lb-node="c2"]');
    expect(css).toContain('@keyframes lb-anim-fade');
    expect(css).toContain('@keyframes lb-anim-zoom');
  });

  it('同类型 @keyframes 去重（只输出一次）', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [
        { id: 'c1', type: 'LubanText', animation: { type: 'fade', trigger: 'load' } },
        { id: 'c2', type: 'LubanText', animation: { type: 'fade', trigger: 'load' } },
        { id: 'c3', type: 'LubanText', animation: { type: 'fade', trigger: 'load' } },
      ],
    };
    const css = treeAnimationCss(root);
    const kfCount = (css.match(/@keyframes lb-anim-fade/g) || []).length;
    expect(kfCount).toBe(1); // 只输出一次
  });

  it('无动画节点返回空串', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [{ id: 'c1', type: 'LubanText', style: { color: 'red' } }],
    };
    expect(treeAnimationCss(root)).toBe('');
  });

  it('混合：有动画 + 无动画节点，只输出有动画的', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [
        { id: 'c1', type: 'LubanText' }, // 无动画
        { id: 'c2', type: 'LubanText', animation: { type: 'fade' } },
      ],
    };
    const css = treeAnimationCss(root);
    expect(css).toContain('[data-lb-node="c2"]');
    expect(css).not.toContain('[data-lb-node="c1"]');
  });
});
