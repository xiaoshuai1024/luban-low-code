export type { PageSchema, NodeSchema } from './lib/schema';
export type { ValidationRule } from './lib/validation';
export { validate } from './lib/validation';
export { default as LubanDesigner } from './lib/LubanDesigner.vue';
export { default as LubanPage } from './lib/LubanPage.vue';
export { default as DesignRenderer } from './lib/DesignRenderer.vue';
export { default as RuntimeRenderer } from './lib/RuntimeRenderer.vue';
export { getComponent, registerComponent } from './lib/registry';
export {
  getComponentMeta,
  getAllComponentMeta,
  registerComponentMeta,
} from './lib/componentMeta';
export type { ComponentMeta, PropSchema, PropSchemaItem } from './lib/componentMeta';
export {
  CONTAINER_TYPES,
  FORM_CONTROL_TYPES,
  isContainerType,
  canAcceptChild,
} from './lib/constants';
export { reorderRootChildren } from './lib/schemaUtils';
export {
  getPaletteGroups,
  getPaletteItems,
  isPaletteType,
} from './lib/palette';
export type { PaletteItem, PaletteCategory, PaletteGroup } from './lib/palette';

// === material contract layer (foundation, 0.1.0) ===
// defineMaterial + MaterialRegistry + JSON Schema 类型 + compat 适配层。
// 旧导出（getComponentMeta 等）保持不变；新物料统一通过 defineMaterial 声明。
export {
  defineMaterial,
  MaterialRegistry,
  materialRegistry,
  toLegacyComponentMeta,
  propsSchemaToLegacy,
  deriveDefaultProps,
} from './lib/material';
export type {
  MaterialDefinition,
  MaterialEvent,
  MaterialSlot,
  JSONSchemaObject,
  JSONSchemaProperty,
  JSONSchemaTypeName,
} from './lib/material';

// === materials aggregation (聚合收口, 0.1.0) ===
// 顶层 import 触发 side-effect：把 14 物料注册到 materialRegistry。
// 该 import 必须出现在包入口，否则单独 import lib/* 的下游会拿到空 registry。
// constants.ts / componentMeta.ts 内部也各自 import './materials' 以保证
// 同步派生时 registry 已就绪；ESM 模块缓存保证只执行一次。
import './materials';
import type { MaterialDefinition } from './lib/material';
export { materials } from './materials';
export {
  buttonMaterial,
  textMaterial,
  bannerMaterial,
  containerMaterial,
  rowMaterial,
  colMaterial,
  sidePanelMaterial,
  formMaterial,
  inputMaterial,
  textAreaMaterial,
  selectMaterial,
  checkboxMaterial,
  radioGroupMaterial,
  switchMaterial,
} from './materials';

/**
 * 按物料 name 取 MaterialDefinition（便捷封装，等价于 materialRegistry.get）。
 * @since 0.1.0
 */
export function getMaterial(name: string): MaterialDefinition | undefined {
  return materialRegistry.get(name);
}

