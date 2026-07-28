/**
 * material-parity.spec — 物料注册漂移回归测试。
 *
 * 验证 materialRegistry 中全部物料的契约不变量：
 *  1. name 唯一（registry 层已保证，这里做端到端断言）；
 *  2. version 为合法 semver；
 *  3. propsSchema.properties 非空（防止误提交空 schema 物料）；
 *  4. （软约束）每个 prop 字段建议声明 default：缺省仅 warn 不 fail。
 *
 * 触发：import './index' 同步触发聚合层 registerAll，registry 即就绪。
 *
 * @since 0.1.0
 */

import { describe, it, expect } from 'vitest';
import './index';
import { materialRegistry } from '../lib/material/registry';
import type { MaterialDefinition } from '../lib/material/defineMaterial';
import { getComponent } from '../lib/registry';
import { getAllComponentMeta } from '../lib/componentMeta';
import { getPaletteGroups, getPaletteItems } from '../lib/palette';
import { CONTAINER_TYPES, FORM_CONTROL_TYPES } from '../lib/constants';

describe('material registry parity', () => {
  const all = materialRegistry.getAll();

  it('registers all 34 materials', () => {
    expect(all.length).toBe(34);
  });

  it('includes SidePanel (首次纳入)', () => {
    expect(materialRegistry.has('LubanSidePanel')).toBe(true);
  });

  it('includes W1-T6 6 new materials (Table/Menu/Tabs/Modal/Drawer/Toast)', () => {
    for (const name of [
      'LubanTable',
      'LubanMenu',
      'LubanTabs',
      'LubanModal',
      'LubanDrawer',
      'LubanToast',
    ]) {
      expect(materialRegistry.has(name)).toBe(true);
    }
  });

  it('W1-T6 materials use new categories (data-display/navigation/feedback)', () => {
    const byName = new Map(all.map((d: MaterialDefinition) => [d.name, d]));
    expect(byName.get('LubanTable')?.category).toBe('data-display');
    expect(byName.get('LubanMenu')?.category).toBe('navigation');
    expect(byName.get('LubanTabs')?.category).toBe('navigation');
    expect(byName.get('LubanModal')?.category).toBe('feedback');
    expect(byName.get('LubanDrawer')?.category).toBe('feedback');
    expect(byName.get('LubanToast')?.category).toBe('feedback');
  });

  it('every material name is unique', () => {
    const names = all.map((d: MaterialDefinition) => d.name);
    const dedup = new Set(names);
    expect(dedup.size).toBe(names.length);
  });

  it('every material has a valid semver version', () => {
    const semverRe =
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.+)?$/;
    for (const def of all) {
      expect(def.version).toMatch(semverRe);
    }
  });

  it('every material propsSchema has non-empty properties', () => {
    for (const def of all) {
      const keys = Object.keys(def.propsSchema?.properties ?? {});
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it('every material component (Vue) is defined', () => {
    for (const def of all) {
      expect(def.component).toBeDefined();
      expect(def.component).not.toBeNull();
    }
  });

  it('containers declare isContainer=true', () => {
    const containers = all.filter((d) => d.isContainer === true);
    // 至少 5 个容器：Container / Row / Col / Form / SidePanel
    expect(containers.length).toBeGreaterThanOrEqual(5);
    const containerNames = containers.map((d) => d.name);
    for (const expected of [
      'LubanContainer',
      'LubanRow',
      'LubanCol',
      'LubanForm',
      'LubanSidePanel',
    ]) {
      expect(containerNames).toContain(expected);
    }
  });

  it('form controls (6) are registered with category=form and non-container', () => {
    const formControls = all.filter(
      (d) => d.category === 'form' && d.isContainer !== true
    );
    expect(formControls.length).toBe(6);
    const names = formControls.map((d) => d.name).sort();
    expect(names).toEqual(
      [
        'LubanCheckbox',
        'LubanInput',
        'LubanRadioGroup',
        'LubanSelect',
        'LubanSwitch',
        'LubanTextArea',
      ].sort()
    );
  });

  it('LubanForm acceptTypes covers all 6 form controls', () => {
    const form = materialRegistry.get('LubanForm');
    expect(form).toBeDefined();
    expect(form?.acceptTypes).toBeDefined();
    const accept = new Set(form?.acceptTypes ?? []);
    expect(accept.size).toBe(6);
    for (const c of [
      'LubanInput',
      'LubanTextArea',
      'LubanSelect',
      'LubanCheckbox',
      'LubanRadioGroup',
      'LubanSwitch',
    ]) {
      expect(accept.has(c)).toBe(true);
    }
  });

  it('getComponent resolves all 34 materials via registry (no undefined)', () => {
    // 验证 registry.ts getComponent 经 materialRegistry 取到全部物料的 component
    for (const def of all) {
      const comp = getComponent(def.name);
      expect(comp).toBeDefined();
    }
  });

  it('getComponentMeta derives ComponentMeta for all 34 materials', () => {
    // 验证 componentMeta.ts 经 compat.toLegacyComponentMeta 派生旧 ComponentMeta
    const metas = getAllComponentMeta();
    expect(metas.length).toBe(34);
    for (const meta of metas) {
      expect(meta.type).toBeTruthy();
      expect(meta.component).toBeDefined();
      expect(Object.keys(meta.propSchema).length).toBeGreaterThan(0);
    }
  });

  it('palette covers 7 groups (信息/布局/表单/营销/导航/反馈/数据展示) — D15-E4 重组', () => {
    // D15-E4：调色板从 2 组扩展为 7 组，全部已注册物料（含 W1-T6 6 物料 +
    // marketing 物料）首次进入调色板。layout 同时进信息+布局两组。
    const groups = getPaletteGroups();
    expect(groups.length).toBe(7);
    expect(groups.map((g) => g.category)).toEqual([
      '信息',
      '布局',
      '表单',
      '营销',
      '导航',
      '反馈',
      '数据展示',
    ]);
    // 信息组含 SidePanel
    const infoTypes = groups.find((g) => g.category === '信息')!.items.map((i) => i.type);
    expect(infoTypes).toContain('LubanSidePanel');
    // 营销组含 marketing 物料（Hero/CTA/Testimonial/LeadCapture category=marketing）
    const marketingTypes = groups.find((g) => g.category === '营销')!.items.map((i) => i.type);
    expect(marketingTypes).toContain('LubanHero');
    expect(marketingTypes).toContain('LubanCTA');
    expect(marketingTypes).toContain('LubanTestimonial');
    expect(marketingTypes).toContain('LubanLeadCapture');
    // 导航/反馈/数据展示组首次纳入 W1-T6 6 物料
    const navTypes = groups.find((g) => g.category === '导航')!.items.map((i) => i.type);
    expect(navTypes).toContain('LubanMenu');
    expect(navTypes).toContain('LubanTabs');
    const feedbackTypes = groups.find((g) => g.category === '反馈')!.items.map((i) => i.type);
    expect(feedbackTypes).toContain('LubanModal');
    expect(feedbackTypes).toContain('LubanDrawer');
    expect(feedbackTypes).toContain('LubanToast');
    const dataTypes = groups.find((g) => g.category === '数据展示')!.items.map((i) => i.type);
    expect(dataTypes).toContain('LubanTable');
    // 扁平列表去重（layout 同时在信息+布局，只算一次）
    const flat = getPaletteItems();
    const flatTypes = new Set(flat.map((i) => i.type));
    expect(flatTypes.size).toBe(flat.length); // 无重复
  });

  it('CONTAINER_TYPES and FORM_CONTROL_TYPES derive from registry', () => {
    expect(CONTAINER_TYPES.has('LubanSidePanel')).toBe(true);
    expect(FORM_CONTROL_TYPES.size).toBe(6);
  });

  // 软约束：缺 default 仅 warn 不 fail（防止阻塞迁移），但 log 出来便于追踪。
  it('(soft) props with missing defaults are logged but not failing', () => {
    const missing: Array<{ material: string; prop: string }> = [];
    for (const def of all) {
      const props = def.propsSchema?.properties ?? {};
      for (const [key, prop] of Object.entries(props)) {
        if (prop && prop.default === undefined) {
          missing.push({ material: def.name, prop: key });
        }
      }
    }
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[material-parity] ${missing.length} props without default (allowed, tracked):\n` +
          missing
            .map((m) => `  - ${m.material}.${m.prop}`)
            .join('\n')
      );
    }
    // 软断言：始终通过（仅记录），未来可改为硬断言。
    expect(true).toBe(true);
  });
});
