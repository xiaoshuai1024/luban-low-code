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
