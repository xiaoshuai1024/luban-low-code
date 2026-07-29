/**
 * V2-T7 CMS 绑定解析单测。
 *
 * 覆盖：
 *  - resolveCmsProps：single/list 两模式 + 排序 + limit
 *  - sortAndLimitItems：updatedAt/字段排序 asc/desc + limit 裁剪
 *  - collectBoundCollectionIds：整树收集去重
 *  - 空 binding / 空Items 边界
 */
import { describe, it, expect } from 'vitest';
import {
  resolveCmsProps,
  sortAndLimitItems,
  collectBoundCollectionIds,
  type ResolvedCollectionItem,
} from '../../src/lib/cmsBinding';
import type { NodeSchema } from '../../src/lib/schema';

describe('V2-T7 resolveCmsProps', () => {
  const items: ResolvedCollectionItem[] = [
    { id: 'i1', data: { title: '第一篇', body: '内容1' }, updatedAt: '2026-01-01' },
    { id: 'i2', data: { title: '第二篇', body: '内容2' }, updatedAt: '2026-01-02' },
  ];

  it('single 模式：取首条（desc 默认）指定字段注入 content', () => {
    const props = resolveCmsProps(
      { collectionId: 'c1', fieldKey: 'title', mode: 'single' },
      items
    );
    // desc 默认 → 首条是 updatedAt 较大的 i2
    expect(props.content).toBe('第二篇');
  });

  it('single 模式：自定义 injectProp', () => {
    const props = resolveCmsProps(
      { collectionId: 'c1', fieldKey: 'body', mode: 'single' },
      items,
      'heading'
    );
    expect(props.heading).toBe('内容2');
  });

  it('list 模式：注入 items 数组', () => {
    const props = resolveCmsProps(
      { collectionId: 'c1', mode: 'list' },
      items
    );
    expect(Array.isArray(props.items)).toBe(true);
    expect((props.items as unknown[]).length).toBe(2);
  });

  it('list 模式：limit 裁剪', () => {
    const props = resolveCmsProps(
      { collectionId: 'c1', mode: 'list', limit: 1 },
      items
    );
    expect((props.items as unknown[]).length).toBe(1);
  });

  it('空 binding 返回 {}', () => {
    expect(resolveCmsProps(undefined, items)).toEqual({});
    expect(resolveCmsProps({ collectionId: '' }, items)).toEqual({});
  });

  it('空 items single 返回空字符串', () => {
    const props = resolveCmsProps(
      { collectionId: 'c1', fieldKey: 'title', mode: 'single' },
      []
    );
    expect(props.content).toBe('');
  });
});

describe('V2-T7 sortAndLimitItems', () => {
  const items: ResolvedCollectionItem[] = [
    { id: 'a', data: { score: 3 }, updatedAt: '2026-03-01' },
    { id: 'b', data: { score: 1 }, updatedAt: '2026-01-01' },
    { id: 'c', data: { score: 2 }, updatedAt: '2026-02-01' },
  ];

  it('默认 updatedAt desc', () => {
    const r = sortAndLimitItems(items, { collectionId: 'c1' });
    expect(r.map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('updatedAt asc', () => {
    const r = sortAndLimitItems(items, { collectionId: 'c1', sortOrder: 'asc' });
    expect(r.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('字段 score desc', () => {
    const r = sortAndLimitItems(items, { collectionId: 'c1', sortBy: 'score', sortOrder: 'desc' });
    expect(r.map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('limit 裁剪', () => {
    const r = sortAndLimitItems(items, { collectionId: 'c1', limit: 2 });
    expect(r.length).toBe(2);
  });
});

describe('V2-T7 collectBoundCollectionIds', () => {
  it('整树收集去重', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [
        { id: 'n1', type: 'LubanText', cmsBinding: { collectionId: 'c1' } },
        {
          id: 'n2',
          type: 'LubanContainer',
          children: [
            { id: 'n3', type: 'LubanText', cmsBinding: { collectionId: 'c2' } },
            { id: 'n4', type: 'LubanText', cmsBinding: { collectionId: 'c1' } }, // 重复 c1
          ],
        },
      ],
    };
    const ids = collectBoundCollectionIds(root);
    expect(ids.sort()).toEqual(['c1', 'c2']);
  });

  it('无绑定返回空数组', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [{ id: 'n1', type: 'LubanText' }],
    };
    expect(collectBoundCollectionIds(root)).toEqual([]);
  });
});
