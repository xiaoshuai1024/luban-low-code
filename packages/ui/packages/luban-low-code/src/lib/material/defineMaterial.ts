/**
 * defineMaterial — 物料契约层（foundation）。
 *
 * 本文件定义后续 13 物料（packages/luban-low-code/src/materials/<category>/<name>/）
 * 并行重构所需的统一"模具"。所有物料通过 `defineMaterial(...)` 声明自身，
 * 由 MaterialRegistry（见 ./registry.ts）统一管理。
 *
 * 设计原则：
 *  - 以 JSON Schema（子集）描述 propsSchema，作为单一事实来源；
 *  - 兼容旧 PropSchemaItem 通过 ./compat.ts 派生（@deprecated，13 物料迁移后逐步退场）；
 *  - 不引入新运行时依赖：semver 校验、JSON Schema 校验均为轻量本地实现。
 *
 * @since 0.1.0
 */

import type { Component } from 'vue';

/**
 * JSON Schema 子集类型定义。
 *
 * 仅覆盖 luban 物料 props 所需的最小集：type / properties / items / enum /
 * default / required / description。完整 JSON Schema 规范不在本契约范围。
 */
export type JSONSchemaTypeName =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

/** 单个属性的最小 JSON Schema 描述。enum 用于有限取值集合。 */
export interface JSONSchemaProperty {
  type?: JSONSchemaTypeName;
  description?: string;
  /** 枚举可选值（type 通常为 string/number）。 */
  enum?: (string | number)[];
  /** 数组元素 schema（type === 'array' 时使用）。 */
  items?: JSONSchemaProperty;
  /** 字段默认值（强烈建议声明，缺省仅告警不抛错）。 */
  default?: unknown;
  /** 字段标签（设计器属性面板展示用，JSON Schema 扩展字段）。 */
  label?: string;
}

/** propsSchema 顶层对象：properties 为字段表，required 为必填字段列表。 */
export interface JSONSchemaObject {
  type?: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
}

/** 物料对外暴露的事件。 */
export interface MaterialEvent {
  name: string;
  description?: string;
}

/** 物料对外暴露的插槽。 */
export interface MaterialSlot {
  name: string;
  description?: string;
}

/**
 * 物料定义契约。
 *
 * 每个物料（如 LubanButton / LubanInput）应通过 defineMaterial 工厂声明
 * 一份 MaterialDefinition，并注册到 MaterialRegistry。
 */
export interface MaterialDefinition {
  /** 物料唯一标识，对应 registry 中的 type（如 'LubanButton'）。 */
  name: string;
  /** 物料版本，semver（如 '0.1.0'）。 */
  version: string;
  /** 物料分类（如 'layout' / 'form' / 'content' / 'button'）。 */
  category: string;
  /** 物料描述（设计器面板展示用）。 */
  description: string;
  /** Vue 组件实现（运行时渲染）。 */
  component: Component;
  /** 是否为容器（可接受子节点，对应设计器 drop zone）。 */
  isContainer?: boolean;
  /** 容器可接受的子物料 name 列表；为空/未定义表示接受任意已注册物料。 */
  acceptTypes?: string[];
  /** props 的 JSON Schema（单一事实来源）。 */
  propsSchema: JSONSchemaObject;
  /** 对外暴露的事件。 */
  events?: MaterialEvent[];
  /** 对外暴露的插槽。 */
  slots?: MaterialSlot[];
}

/**
 * 轻量 semver 校验正则（major.minor.patch + 可选预发布）。
 *
 * 不引入 semver 等第三方依赖；覆盖 X.Y.Z 与 X.Y.Z-<pre> 两种常见形态，
 * 满足物料版本声明场景。完整 semver 规范（build metadata、range）不在范围。
 *
 * 详见 https://semver.org/ 。
 */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

/**
 * 校验 semver 字符串。
 * @internal 仅在本模块内使用，不对外导出。
 */
function isValidSemver(version: string): boolean {
  return SEMVER_RE.test(version.trim());
}

/**
 * 校验 name 非空字符串。
 * @internal
 */
function isNonEmptyName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0;
}

/**
 * 对 propsSchema 中缺少 default 的字段输出告警（不抛错，避免阻塞迁移）。
 * @internal
 */
function warnMissingDefaults(def: MaterialDefinition): void {
  if (typeof console === 'undefined' || !def.propsSchema?.properties) return;
  for (const [key, prop] of Object.entries(def.propsSchema.properties)) {
    if (prop && prop.default === undefined) {
      // 仅 warn，不 throw：旧物料迁移期间允许逐步补 default。
      // eslint-disable-next-line no-console
      console.warn(
        `[luban-low-code] material "${def.name}" prop "${key}" has no default; ` +
          'consider declaring a default in propsSchema to stabilize design-time defaults.'
      );
    }
  }
}

/**
 * 物料工厂：接收 MaterialDefinition，执行轻量校验后原样返回。
 *
 * 校验规则：
 *  - name 必须为非空字符串（throw）；
 *  - version 必须为合法 semver（throw）；
 *  - propsSchema 字段缺 default 仅 warn（不阻塞）。
 *
 * 注：唯一性校验由 MaterialRegistry.register 负责，工厂本身不重复检查。
 *
 * @example
 * ```ts
 * const button = defineMaterial({
 *   name: 'LubanButton',
 *   version: '0.1.0',
 *   category: 'button',
 *   description: '按钮',
 *   component: LubanButton,
 *   propsSchema: {
 *     properties: {
 *       content: { type: 'string', default: '按钮', label: '文案' },
 *       disabled: { type: 'boolean', default: false, label: '禁用' },
 *     },
 *   },
 *   events: [{ name: 'click', description: '点击' }],
 * });
 * ```
 */
export function defineMaterial(def: MaterialDefinition): MaterialDefinition {
  if (!isNonEmptyName(def.name)) {
    throw new Error(
      `[luban-low-code] defineMaterial: "name" must be a non-empty string (got ${JSON.stringify(
        def.name
      )})`
    );
  }
  if (typeof def.version !== 'string' || !isValidSemver(def.version)) {
    throw new Error(
      `[luban-low-code] defineMaterial: "version" of "${def.name}" must be a valid semver ` +
        `(got ${JSON.stringify(def.version)})`
    );
  }
  if (!def.propsSchema || typeof def.propsSchema !== 'object') {
    throw new Error(
      `[luban-low-code] defineMaterial: "propsSchema" of "${def.name}" must be a JSONSchemaObject`
    );
  }
  warnMissingDefaults(def);
  return def;
}
