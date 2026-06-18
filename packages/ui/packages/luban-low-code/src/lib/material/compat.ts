/**
 * compat — JSON Schema → 旧 ComponentMeta/PropSchemaItem 适配层（foundation）。
 *
 * @deprecated since 0.1.0
 * 本文件仅在 13 物料迁移过渡期使用：旧设计器/属性面板仍消费
 * ComponentMeta（componentMeta.ts）。迁移完成后，设计器应直接消费
 * MaterialDefinition / propsSchema（JSON Schema），本适配层将移除。
 *
 * 转换规则（JSON Schema property → PropSchemaItem.type）：
 *  - string            → 'string'
 *  - number / integer  → 'number'
 *  - boolean           → 'boolean'
 *  - 含 enum           → 'select'（options 由 enum 派生为 {label,value}[]）
 *  - array             → 'options'（沿用旧 LubanSelect/LubanRadioGroup 的 options 语义；
 *                         若 items 描述为复杂对象，回退为 'json'）
 *  - object / 其他     → 'json'
 *
 * @since 0.1.0
 */

import type { Component } from 'vue';
import type { MaterialDefinition, JSONSchemaProperty, MaterialEvent } from './defineMaterial';
import type { ComponentMeta, PropSchemaItem } from '../componentMeta';

/** JSON Schema property → 旧 PropSchemaItem 单字段映射。 */
function toPropSchemaItem(prop: JSONSchemaProperty): PropSchemaItem {
  // enum 优先：有限取值集合映射为 select。
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    const enumValues: (string | number)[] = prop.enum;
    return {
      type: 'select',
      label: prop.label,
      default: prop.default,
      options: enumValues.map((value: string | number) => ({
        label: String(value),
        value,
      })),
    };
  }

  switch (prop.type) {
    case 'string':
      return {
        type: 'string',
        label: prop.label,
        default: prop.default,
      };
    case 'number':
    case 'integer':
      return {
        type: 'number',
        label: prop.label,
        default: prop.default,
      };
    case 'boolean':
      return {
        type: 'boolean',
        label: prop.label,
        default: prop.default,
      };
    case 'array':
      // 旧 LubanSelect/LubanRadioGroup 的 options 字段为对象数组，
      // 用 'options' 类型；若元素 schema 非平凡（如嵌套 object），回退 'json'。
      if (prop.items && (prop.items.type === 'object' || !prop.items.type)) {
        return {
          type: 'json',
          label: prop.label,
          default: prop.default ?? [],
        };
      }
      return {
        type: 'options',
        label: prop.label,
        default: prop.default ?? [],
      };
    case 'object':
    case 'null':
    default:
      return {
        type: 'json',
        label: prop.label,
        default: prop.default,
      };
  }
}

/** 从 required 字段集合判断单个 key 是否必填。 */
function isRequired(required: string[] | undefined, key: string): boolean {
  return Array.isArray(required) && required.includes(key);
}

/**
 * 把 MaterialDefinition 的 JSON Schema propsSchema 转为旧 PropSchema 表。
 *
 * @deprecated since 0.1.0 由 toLegacyComponentMeta 内部调用，迁移期临时 API。
 */
export function propsSchemaToLegacy(
  def: MaterialDefinition
): Record<string, PropSchemaItem> {
  const out: Record<string, PropSchemaItem> = {};
  const props: Record<string, JSONSchemaProperty> = def.propsSchema?.properties ?? {};
  const required = def.propsSchema?.required;
  for (const key of Object.keys(props)) {
    const prop: JSONSchemaProperty | undefined = props[key];
    if (!prop) continue;
    const item = toPropSchemaItem(prop);
    if (isRequired(required, key)) {
      item.required = true;
    }
    out[key] = item;
  }
  return out;
}

/**
 * 由 MaterialDefinition 派生 defaultProps（取各字段 default）。
 *
 * @deprecated since 0.1.0 迁移期临时 API，迁移后设计器直接读 propsSchema。
 */
export function deriveDefaultProps(def: MaterialDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const props: Record<string, JSONSchemaProperty> = def.propsSchema?.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop: JSONSchemaProperty | undefined = props[key];
    if (!prop) continue;
    if (prop.default !== undefined) {
      out[key] = prop.default;
    }
  }
  return out;
}

/**
 * 将 MaterialDefinition 转换为旧 ComponentMeta。
 *
 * @deprecated since 0.1.0
 * 该函数为 13 物料迁移过渡期使用；旧 componentMeta.ts 的 buildDefaultMeta
 * 最终将由本函数（基于 materialRegistry）派生，逐步退场。
 *
 * 注：旧 ComponentMeta.category 类型为联合字面量，迁移期由调用方确保
 * MaterialDefinition.category 取值落在该联合内（本函数仅做透传，不做强校验）。
 */
export function toLegacyComponentMeta(def: MaterialDefinition): ComponentMeta {
  const component: Component = def.component;
  return {
    type: def.name,
    // 迁移期：MaterialDefinition.category 字符串透传为旧联合类型，
    // 具体取值由各物料声明时约束在 'layout'|'form'|'content'|'button'。
    category: def.category as ComponentMeta['category'],
    label: def.description,
    component,
    propSchema: propsSchemaToLegacy(def),
    defaultProps: deriveDefaultProps(def),
    events: (def.events ?? []).map((e: MaterialEvent) => e.name),
    isContainer: def.isContainer,
    acceptTypes: def.acceptTypes,
  };
}
