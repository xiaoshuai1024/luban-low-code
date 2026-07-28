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
import type { ComponentMeta, PropSchemaItem, PropSchema } from '../componentMeta';

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
      // 数组元素分类映射（D15-E0 数组可视化编辑器基建）：
      //  - 元素为 object 且声明了 items.properties → 'array'（带 itemFields），
      //    PropertyPanel 渲染可视化列表编辑器（每行 N 字段）。
      //  - 元素为对象数组但 items 缺 properties（如旧 LubanSelect 的 {label,value}
      //    通过 items.properties 声明）→ 仍走 'array'，由 itemFields 描述。
      //  - 元素为 primitive（string/number）或无 items → 'options'（沿用旧语义）。
      //  - 嵌套数组（itemFields 内仍含 array/object）→ 降级 'json'（v1 不支持可视化嵌套）。
      if (
        prop.items &&
        (prop.items.type === 'object' || !prop.items.type) &&
        prop.items.properties
      ) {
        const itemFields = deriveItemFields(prop.items.properties);
        // 任一字段仍为数组/对象 → 整体降级 json（防嵌套可视化爆炸）
        if (itemFields && hasNestedComplex(itemFields)) {
          return {
            type: 'json',
            label: prop.label,
            default: prop.default ?? [],
          };
        }
        return {
          type: 'array',
          label: prop.label,
          default: prop.default ?? [],
          itemFields,
        };
      }
      // 旧 LubanSelect/LubanRadioGroup 的 options 字段：元素为 {label,value}，
      // 但若未通过 items.properties 显式声明结构，沿用 'options'。
      if (prop.items && (prop.items.type === 'object' || !prop.items.type)) {
        return {
          type: 'options',
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

/**
 * 从数组元素 schema 的 properties 派生 itemFields（PropSchema 表）。
 * 递归调用 toPropSchemaItem，使每字段复用同一映射规则。
 */
function deriveItemFields(
  properties: Record<string, JSONSchemaProperty>
): PropSchema | undefined {
  const keys = Object.keys(properties);
  if (keys.length === 0) return undefined;
  const out: PropSchema = {};
  for (const key of keys) {
    const p = properties[key];
    if (!p) continue;
    out[key] = toPropSchemaItem(p);
  }
  return out;
}

/**
 * 检查 itemFields 是否含嵌套复杂类型（array/json/options）。
 * 含则父数组降级为 json 编辑（v1 不支持可视化嵌套数组）。
 */
function hasNestedComplex(itemFields: PropSchema): boolean {
  for (const item of Object.values(itemFields)) {
    if (item.type === 'array' || item.type === 'json') return true;
    // options 是扁平 {label,value}，不算复杂，保留可视化
  }
  return false;
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
    capabilities: def.capabilities,
  };
}
