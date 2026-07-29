/**
 * V2-T4 响应式断点单测。
 *
 * 覆盖：
 *  - resolveResponsiveProps：三断点折叠优先级（desktop→tablet→mobile）
 *  - hasResponsiveOverrides：有无覆盖判定
 *  - nodeResponsiveCss：@media CSS 输出（tablet/mobile）
 *  - treeResponsiveCss：整树遍历
 *  - camelCase → kebab-case 转换
 *  - 无响应式节点不输出空 CSS
 */
import { describe, it, expect } from 'vitest';
import {
  resolveResponsiveProps,
  hasResponsiveOverrides,
  BREAKPOINTS,
} from '../../src/lib/responsive';
import { nodeResponsiveCss, treeResponsiveCss } from '../../src/lib/responsiveStyle';
import type { NodeSchema } from '../../src/lib/schema';

describe('V2-T4 resolveResponsiveProps', () => {
  it('desktop 返回 node.style', () => {
    const node: NodeSchema = {
      id: 'n1',
      type: 'LubanText',
      style: { color: 'red', fontSize: '16px' },
    };
    expect(resolveResponsiveProps(node, 'desktop')).toEqual({ color: 'red', fontSize: '16px' });
  });

  it('tablet 浅合并覆盖 desktop', () => {
    const node: NodeSchema = {
      id: 'n1',
      type: 'LubanText',
      style: { color: 'red', fontSize: '16px' },
      responsive: { tablet: { fontSize: '14px' } },
    };
    const r = resolveResponsiveProps(node, 'tablet');
    expect(r.color).toBe('red'); // 保留 desktop
    expect(r.fontSize).toBe('14px'); // tablet 覆盖
  });

  it('mobile 先合并 tablet 再合并 mobile', () => {
    const node: NodeSchema = {
      id: 'n1',
      type: 'LubanText',
      style: { color: 'red', fontSize: '16px', display: 'block' },
      responsive: {
        tablet: { fontSize: '14px' },
        mobile: { display: 'none', fontSize: '12px' },
      },
    };
    const r = resolveResponsiveProps(node, 'mobile');
    expect(r.color).toBe('red');
    expect(r.fontSize).toBe('12px'); // mobile 覆盖 tablet 覆盖 desktop
    expect(r.display).toBe('none');
  });

  it('无 responsive 时所有断点都返回 desktop style', () => {
    const node: NodeSchema = { id: 'n1', type: 'LubanText', style: { color: 'blue' } };
    expect(resolveResponsiveProps(node, 'tablet')).toEqual({ color: 'blue' });
    expect(resolveResponsiveProps(node, 'mobile')).toEqual({ color: 'blue' });
  });
});

describe('V2-T4 hasResponsiveOverrides', () => {
  it('无 responsive 返回 false', () => {
    expect(hasResponsiveOverrides({ id: 'n', type: 't' })).toBe(false);
  });

  it('responsive 为空对象返回 false', () => {
    expect(hasResponsiveOverrides({ id: 'n', type: 't', responsive: {} })).toBe(false);
  });

  it('tablet 有键返回 true', () => {
    expect(
      hasResponsiveOverrides({ id: 'n', type: 't', responsive: { tablet: { color: 'red' } } })
    ).toBe(true);
  });

  it('mobile 有键返回 true', () => {
    expect(
      hasResponsiveOverrides({ id: 'n', type: 't', responsive: { mobile: { color: 'red' } } })
    ).toBe(true);
  });
});

describe('V2-T4 nodeResponsiveCss', () => {
  it('无 responsive 返回空串', () => {
    const node: NodeSchema = { id: 'n1', type: 'LubanText', style: { color: 'red' } };
    expect(nodeResponsiveCss(node)).toBe('');
  });

  it('tablet 覆盖输出 @media max-width:1024px', () => {
    const node: NodeSchema = {
      id: 'n1',
      type: 'LubanText',
      responsive: { tablet: { fontSize: '14px' } },
    };
    const css = nodeResponsiveCss(node);
    expect(css).toContain(`@media (max-width: ${BREAKPOINTS.tablet}px)`);
    expect(css).toContain('[data-lb-node="n1"]');
    expect(css).toContain('font-size: 14px');
  });

  it('mobile 覆盖输出 @media max-width:768px', () => {
    const node: NodeSchema = {
      id: 'n2',
      type: 'LubanText',
      responsive: { mobile: { display: 'none' } },
    };
    const css = nodeResponsiveCss(node);
    expect(css).toContain(`@media (max-width: ${BREAKPOINTS.mobile}px)`);
    expect(css).toContain('display: none');
  });

  it('camelCase 转 kebab-case', () => {
    const node: NodeSchema = {
      id: 'n3',
      type: 'LubanText',
      responsive: { tablet: { backgroundColor: '#fff', marginTop: '10px' } },
    };
    const css = nodeResponsiveCss(node);
    expect(css).toContain('background-color: #fff');
    expect(css).toContain('margin-top: 10px');
    expect(css).not.toContain('backgroundColor');
  });

  it('tablet + mobile 都有覆盖输出两段 @media', () => {
    const node: NodeSchema = {
      id: 'n4',
      type: 'LubanText',
      responsive: {
        tablet: { fontSize: '14px' },
        mobile: { fontSize: '12px' },
      },
    };
    const css = nodeResponsiveCss(node);
    expect(css.match(/@media/g)?.length).toBe(2);
  });

  it('空值的属性被过滤', () => {
    const node: NodeSchema = {
      id: 'n5',
      type: 'LubanText',
      responsive: { tablet: { color: '', fontSize: '14px' } },
    };
    const css = nodeResponsiveCss(node);
    expect(css).not.toContain('color:');
    expect(css).toContain('font-size: 14px');
  });
});

describe('V2-T4 treeResponsiveCss', () => {
  it('递归遍历子节点收集 @media', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [
        { id: 'c1', type: 'LubanText', responsive: { tablet: { fontSize: '14px' } } },
        {
          id: 'c2',
          type: 'LubanContainer',
          children: [
            { id: 'c2a', type: 'LubanText', responsive: { mobile: { display: 'none' } } },
          ],
        },
      ],
    };
    const css = treeResponsiveCss(root);
    expect(css).toContain('[data-lb-node="c1"]');
    expect(css).toContain('[data-lb-node="c2a"]');
    expect(css.match(/@media/g)?.length).toBe(2);
  });

  it('整树无响应式覆盖返回空串', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [{ id: 'c1', type: 'LubanText', style: { color: 'red' } }],
    };
    expect(treeResponsiveCss(root)).toBe('');
  });
});
