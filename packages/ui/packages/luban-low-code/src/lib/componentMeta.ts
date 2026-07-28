/**
 * componentMeta — 设计期组件元数据（向后兼容旧 API）。
 *
 * @migration 13+1 物料 schema 重构（聚合收口，0.1.0）
 *
 * 重构后行为（保持导出签名零破坏）：
 *  - getComponentMeta / getAllComponentMeta 改为从 materialRegistry 取
 *    MaterialDefinition，经 compat.toLegacyComponentMeta 派生旧 ComponentMeta
 *    （PropSchemaItem 形态）；
 *  - registerComponentMeta 保留：允许下游覆盖/追加 meta（写入 override 表，
 *    优先级高于 registry 派生）；
 *  - ComponentMeta / PropSchemaItem / PropSchema 类型导出不变。
 *
 * @since 0.1.0
 */

import type { Component } from 'vue';
import { materialRegistry } from './material/registry';
import { toLegacyComponentMeta } from './material/compat';

// 顶层 side-effect import：在同步派生 meta 前确保 materialRegistry 已注册
// 全部 14 物料。materials 聚合层只求值一次（ESM 模块缓存）。
//
// 循环依赖分析：materials/* 物料经 compat.ts 仅以 `import type` 引用本文件
// 的 ComponentMeta/PropSchemaItem（运行时擦除），故无运行时循环。
import '../materials';

/**
 * Schema for a single prop (for property panel and validation).
 */
export interface PropSchemaItem {
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'json'
    | 'options'
    | 'array';
  default?: unknown;
  required?: boolean;
  /** For select: { label: string; value: string | number }[] */
  options?: { label: string; value: string | number }[];
  /**
   * For array: 描述数组每个元素的字段表（派生自 JSONSchema items.properties）。
   * PropertyPanel 数组控件据此渲染每行 N 个字段输入；兼容层（compat.ts）从
   * MaterialDefinition propsSchema 的 array.items.properties 派生本字段。
   * 嵌套数组（itemFields 内仍含 array）由控件递归降级为 json 编辑（v1 不支持可视化嵌套）。
   */
  itemFields?: PropSchema;
  label?: string;
}

export type PropSchema = Record<string, PropSchemaItem>;

/**
 * Component metadata for design-time: property panel, default props, and drop rules.
 */
export interface ComponentMeta {
  type: string;
  category: 'layout' | 'form' | 'content' | 'button';
  label: string;
  component: Component;
  propSchema: PropSchema;
  defaultProps: Record<string, unknown>;
  events: string[];
  /** If true, this component can accept child nodes (drop zone). */
  isContainer?: boolean;
  /** Allowed child types when isContainer; empty = any registered. */
  acceptTypes?: string[];
  /** V2-T5 物料能力声明（动画触发类型等）；未定义 = 全部支持 */
  capabilities?: { animationTriggers?: Array<'in-view' | 'hover' | 'load'> };
}

/**
 * 运行时 override 表：registerComponentMeta 写入的 meta 优先于 registry 派生。
 *
 * 用途：下游可在不改物料定义的情况下覆盖某 meta（如替换 component 实现）。
 */
const overrides: Record<string, ComponentMeta> = {};

/**
 * 缓存：registry 派生的 meta 按 type 索引。
 *
 * 由顶层 `import '../materials'` 触发的同步注册完成后，materialRegistry 已含
 * 全部 14 物料；本缓存首次访问时惰性派生（toLegacyComponentMeta），后续命中。
 * registerComponentMeta 写入 overrides 不污染本缓存（override 在 getter 内合并）。
 */
let derivedCache: Record<string, ComponentMeta> | undefined;

/**
 * 惰性填充 derivedCache（同步）。
 *
 * 顶层 import '../materials' 保证 materialRegistry 在本函数首次调用前已就绪；
 * 若 registry 为空（极端隔离场景，如直接 import 本文件但 materials 未加载），
 * 跳过填充，getComponentMeta 返回 undefined，由调用方处理。
 *
 * @internal
 */
function fillDerived(): void {
  if (derivedCache) return;
  if (materialRegistry.size === 0) return; // materials 尚未注册（防御）
  const cache: Record<string, ComponentMeta> = {};
  for (const def of materialRegistry.getAll()) {
    cache[def.name] = toLegacyComponentMeta(def);
  }
  derivedCache = cache;
}

/**
 * @deprecated since 0.1.0
 * 旧 buildDefaultMeta 的硬编码注册逻辑已移除（13+1 物料全部由 materialRegistry
 * 派生）。本函数保留为 no-op 仅为兼容旧 import；新代码不应依赖本函数。
 */
function buildDefaultMeta(): void {
  // no-op：meta 由 materialRegistry + compat 派生（见 fillDerived）。
}

export function getComponentMeta(type: string): ComponentMeta | undefined {
  fillDerived();
  // override 优先于 registry 派生
  if (Object.prototype.hasOwnProperty.call(overrides, type)) {
    return overrides[type];
  }
  return derivedCache?.[type];
}

export function getAllComponentMeta(): ComponentMeta[] {
  fillDerived();
  // 合并：registry 派生 + override（override 覆盖同名）
  const merged: Record<string, ComponentMeta> = {};
  if (derivedCache) {
    for (const [k, v] of Object.entries(derivedCache)) {
      merged[k] = v;
    }
  }
  for (const [k, v] of Object.entries(overrides)) {
    merged[k] = v;
  }
  return Object.values(merged);
}

export function registerComponentMeta(meta: ComponentMeta): void {
  overrides[meta.type] = meta;
}

/**
 * 测试/重置用：清空 override 与派生缓存（不 unregister materialRegistry）。
 *
 * @internal 仅测试场景使用，不对外稳定保证。
 */
export function __resetComponentMetaCacheForTest(): void {
  for (const key of Object.keys(overrides)) {
    delete overrides[key];
  }
  derivedCache = undefined;
}

// 保留 buildDefaultMeta 引用以兼容旧 import（防 tree-shake 后导出名变化）。
export { buildDefaultMeta };
