/**
 * compat.spec — JSON Schema → PropSchemaItem 映射单测（D15-E0 数组可视化编辑器基建）。
 *
 * 锁定关键映射不变量：
 *  - object-item array（含 items.properties）→ 'array' + itemFields
 *  - primitive array / 无 items → 'options'
 *  - 嵌套数组（itemFields 含 array/object）→ 'json'（防可视化嵌套）
 *  - enum → 'select'；string/number/boolean passthrough
 *
 * 不直接 import toPropSchemaItem（内部函数），改经 toLegacyComponentMeta /
 * propsSchemaToLegacy 间接验证（公开 API），更贴近真实消费链。
 */
import { describe, it, expect } from 'vitest';
import type { MaterialDefinition } from '../../src/lib/material/defineMaterial';
import { defineMaterial } from '../../src/lib/material/defineMaterial';
import { toLegacyComponentMeta, propsSchemaToLegacy } from '../../src/lib/material/compat';
import { h } from 'vue';

/** 构造一个最小物料（仅用于 propsSchema 映射测试，component 用占位）。 */
function makeDef(propsSchema: MaterialDefinition['propsSchema']): MaterialDefinition {
  return defineMaterial({
    name: `Test_${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0.0',
    category: 'marketing',
    description: 'test',
    component: { render: () => h('div') },
    propsSchema,
  });
}

describe('compat.toPropSchemaItem — array mapping (D15-E0)', () => {
  it('object-item array with items.properties → type:array + itemFields', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          label: '特性卡片',
          default: [],
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', default: '', label: '标题' },
              desc: { type: 'string', default: '', label: '描述' },
            },
          },
        },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.cards.type).toBe('array');
    expect(legacy.cards.itemFields).toBeDefined();
    expect(Object.keys(legacy.cards.itemFields!)).toEqual(['title', 'desc']);
    expect(legacy.cards.itemFields!.title.type).toBe('string');
    expect(legacy.cards.default).toEqual([]);
  });

  it('object-item array with items.properties containing number/boolean/select → itemFields 各类型派生', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        plans: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              price: { type: 'number', default: 0 },
              featured: { type: 'boolean', default: false },
              tier: { type: 'string', enum: ['basic', 'pro'], default: 'basic' },
            },
          },
        },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.plans.type).toBe('array');
    expect(legacy.plans.itemFields!.price.type).toBe('number');
    expect(legacy.plans.itemFields!.featured.type).toBe('boolean');
    // enum → select
    expect(legacy.plans.itemFields!.tier.type).toBe('select');
    expect(legacy.plans.itemFields!.tier.options?.map((o) => o.value)).toEqual([
      'basic',
      'pro',
    ]);
  });

  it('nested array (itemFields contains array) → parent degrades to json (v1 no nested visual)', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', default: '' },
              links: {
                // 嵌套数组 → 父 columns 应降级 json
                type: 'array',
                items: {
                  type: 'object',
                  properties: { label: { type: 'string' }, url: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.columns.type).toBe('json');
    expect(legacy.columns.itemFields).toBeUndefined();
  });

  it('primitive array (string items) without object properties → type:options (legacy LubanSelect semantics)', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        tags: { type: 'array', default: [], items: { type: 'string' } },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.tags.type).toBe('options');
  });

  it('object-item array WITHOUT items.properties → type:options (fallback)', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        opts: { type: 'array', items: { type: 'object' } },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.opts.type).toBe('options');
  });

  it('array without items → type:options', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        bare: { type: 'array', default: [] },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.bare.type).toBe('options');
  });
});

describe('compat — non-array passthrough (regression)', () => {
  it('enum → select with derived options', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        align: { type: 'string', enum: ['left', 'center', 'right'], default: 'center' },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.align.type).toBe('select');
    expect(legacy.align.options?.length).toBe(3);
  });

  it('string/number/boolean → respective types', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        s: { type: 'string' },
        n: { type: 'number' },
        i: { type: 'integer' },
        b: { type: 'boolean' },
      },
    });
    const legacy = propsSchemaToLegacy(def);
    expect(legacy.s.type).toBe('string');
    expect(legacy.n.type).toBe('number');
    expect(legacy.i.type).toBe('number');
    expect(legacy.b.type).toBe('boolean');
  });

  it('object → json', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        cfg: { type: 'object' },
      },
    });
    expect(propsSchemaToLegacy(def).cfg.type).toBe('json');
  });
});

describe('compat.toLegacyComponentMeta — end-to-end', () => {
  it('derives ComponentMeta with propSchema containing array itemFields', () => {
    const def = makeDef({
      type: 'object',
      properties: {
        features: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', default: '' },
            },
          },
        },
      },
    });
    const meta = toLegacyComponentMeta(def);
    expect(meta.propSchema.features.type).toBe('array');
    expect(meta.propSchema.features.itemFields?.title.type).toBe('string');
  });
});
