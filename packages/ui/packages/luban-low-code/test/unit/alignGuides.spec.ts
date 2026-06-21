/**
 * V2-T12 对齐辅助线单测。
 *
 * 覆盖：
 *  - computeAlignGuides：左/中/右 + 顶/中/底 对齐检测
 *  - 阈值外不触发
 *  - 吸附坐标计算
 *  - 多节点同时产生多条辅助线
 *  - dedupeGuides 去重 + 范围合并
 *  - collectNodeRects DOM 收集（jsdom）
 */
import { describe, it, expect } from 'vitest';
import {
  computeAlignGuides,
  dedupeGuides,
  collectNodeRects,
  computeSpacingHints,
  type Rect,
} from '../../src/lib/alignGuides';

describe('V2-T12 computeAlignGuides', () => {
  it('左边缘对齐触发垂直辅助线', () => {
    const dragging: Rect = { id: 'd', left: 100, top: 50, width: 80, height: 40 };
    const others: Rect[] = [{ id: 'o', left: 100, top: 200, width: 60, height: 40 }];
    const result = computeAlignGuides(dragging, others);
    const vGuides = result.guides.filter((g) => g.orientation === 'vertical');
    expect(vGuides.length).toBeGreaterThan(0);
    expect(vGuides.some((g) => g.position === 100)).toBe(true);
  });

  it('水平中线对齐触发水平辅助线', () => {
    const dragging: Rect = { id: 'd', left: 100, top: 50, width: 80, height: 40 };
    // 其他节点 top+height/2 = 50+20 = 70 = dragging center 70
    const others: Rect[] = [{ id: 'o', left: 300, top: 50, width: 60, height: 40 }];
    const result = computeAlignGuides(dragging, others);
    const hGuides = result.guides.filter((g) => g.orientation === 'horizontal');
    expect(hGuides.length).toBeGreaterThan(0);
  });

  it('阈值外（所有 6 轴都不对齐）不触发辅助线', () => {
    const dragging: Rect = { id: 'd', left: 100, top: 50, width: 80, height: 40 };
    // 所有边缘都对不齐：left/centerX/right 与 top/centerY/bottom 均差 >6
    const others: Rect[] = [{ id: 'o', left: 500, top: 600, width: 73, height: 63 }];
    const result = computeAlignGuides(dragging, others);
    expect(result.guides.length).toBe(0);
    expect(result.snap).toBeUndefined();
  });

  it('返回吸附坐标（snap.x 让左边缘对齐）', () => {
    const dragging: Rect = { id: 'd', left: 102, top: 50, width: 80, height: 40 };
    const others: Rect[] = [{ id: 'o', left: 100, top: 200, width: 60, height: 40 }];
    const result = computeAlignGuides(dragging, others, 6);
    expect(result.snap?.x).toBe(100); // 吸附到 o.left，dragging.left 应移到 100
  });

  it('多节点同时产生辅助线', () => {
    const dragging: Rect = { id: 'd', left: 100, top: 50, width: 80, height: 40 };
    const others: Rect[] = [
      { id: 'o1', left: 100, top: 200, width: 60, height: 40 },
      { id: 'o2', left: 250, top: 50, width: 60, height: 40 }, // top 对齐
    ];
    const result = computeAlignGuides(dragging, others);
    expect(result.guides.length).toBeGreaterThanOrEqual(2);
  });

  it('右边缘对齐', () => {
    // dragging right = 100+80 = 180; other right = 120+60 = 180
    const dragging: Rect = { id: 'd', left: 100, top: 50, width: 80, height: 40 };
    const others: Rect[] = [{ id: 'o', left: 120, top: 200, width: 60, height: 40 }];
    const result = computeAlignGuides(dragging, others);
    expect(result.guides.some((g) => g.orientation === 'vertical' && g.position === 180)).toBe(true);
  });
});

describe('V2-T12 dedupeGuides', () => {
  it('相同 position+orientation 去重并合并范围', () => {
    const guides = [
      { position: 100, orientation: 'vertical' as const, start: 10, end: 50 },
      { position: 100, orientation: 'vertical' as const, start: 30, end: 80 },
      { position: 100, orientation: 'vertical' as const, start: 5, end: 20 },
    ];
    const deduped = dedupeGuides(guides);
    expect(deduped.length).toBe(1);
    expect(deduped[0].start).toBe(5); // 最小 start
    expect(deduped[0].end).toBe(80); // 最大 end
  });

  it('不同 position 不合并', () => {
    const guides = [
      { position: 100, orientation: 'vertical' as const, start: 10, end: 50 },
      { position: 200, orientation: 'vertical' as const, start: 10, end: 50 },
    ];
    expect(dedupeGuides(guides).length).toBe(2);
  });

  it('vertical/horizontal 同 position 不合并', () => {
    const guides = [
      { position: 100, orientation: 'vertical' as const, start: 10, end: 50 },
      { position: 100, orientation: 'horizontal' as const, start: 10, end: 50 },
    ];
    expect(dedupeGuides(guides).length).toBe(2);
  });
});

describe('V2-T12 collectNodeRects', () => {
  it('jsdom 下收集 data-lb-node 元素矩形', () => {
    const container = document.createElement('div');
    const el1 = document.createElement('div');
    el1.setAttribute('data-lb-node', 'n1');
    const el2 = document.createElement('div');
    el2.setAttribute('data-lb-node', 'n2');
    container.appendChild(el1);
    container.appendChild(el2);
    // jsdom getBoundingClientRect 返回 0，但函数不应抛错
    const rects = collectNodeRects(container, null);
    expect(rects.length).toBe(2);
    expect(rects.map((r) => r.id)).toEqual(['n1', 'n2']);
  });

  it('排除 draggingId', () => {
    const container = document.createElement('div');
    const el1 = document.createElement('div');
    el1.setAttribute('data-lb-node', 'n1');
    container.appendChild(el1);
    const rects = collectNodeRects(container, 'n1');
    expect(rects.length).toBe(0);
  });

  it('null container 返回空数组', () => {
    expect(collectNodeRects(null, null)).toEqual([]);
  });
});

describe('V2-T12 computeSpacingHints', () => {
  it('水平相邻节点生成垂直间距（y 投影重叠）', () => {
    const dragging: Rect = { id: 'd', left: 120, top: 50, width: 80, height: 40 };
    // other 在 dragging 左侧，x 间隙 = 120-100 = 20，y 投影重叠
    const others: Rect[] = [{ id: 'o', left: 20, top: 50, width: 80, height: 40 }];
    const hints = computeSpacingHints(dragging, others);
    const vHints = hints.filter((h) => h.orientation === 'vertical');
    expect(vHints.length).toBeGreaterThan(0);
    expect(vHints[0].distance).toBe(20);
  });

  it('垂直相邻节点生成水平间距（x 投影重叠）', () => {
    const dragging: Rect = { id: 'd', left: 50, top: 120, width: 80, height: 40 };
    // other 在 dragging 上方，y 间隙 = 120-90 = 30，x 投影重叠
    const others: Rect[] = [{ id: 'o', left: 50, top: 50, width: 80, height: 40 }];
    const hints = computeSpacingHints(dragging, others);
    const hHints = hints.filter((h) => h.orientation === 'horizontal');
    expect(hHints.length).toBeGreaterThan(0);
    expect(hHints[0].distance).toBe(30);
  });

  it('无投影重叠（对角错开）不生成间距', () => {
    const dragging: Rect = { id: 'd', left: 500, top: 500, width: 80, height: 40 };
    const others: Rect[] = [{ id: 'o', left: 20, top: 20, width: 80, height: 40 }];
    expect(computeSpacingHints(dragging, others).length).toBe(0);
  });

  it('computeAlignGuides 返回 spacingHints 字段', () => {
    const dragging: Rect = { id: 'd', left: 120, top: 50, width: 80, height: 40 };
    const others: Rect[] = [{ id: 'o', left: 20, top: 50, width: 80, height: 40 }];
    const result = computeAlignGuides(dragging, others);
    expect(Array.isArray(result.spacingHints)).toBe(true);
  });
});
