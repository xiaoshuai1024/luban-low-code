/**
 * material barrel — 物料契约层（foundation）统一出口。
 *
 * 13 物料迁移完成后，src/materials/<category>/<name>/ 下的各物料
 * 将通过本层注册到 materialRegistry；设计器随后从 registry 取物料
 * 而非旧 componentMeta.ts/buildDefaultMeta。
 *
 * @since 0.1.0
 */

export {
  defineMaterial,
  type MaterialDefinition,
  type MaterialEvent,
  type MaterialSlot,
  type JSONSchemaObject,
  type JSONSchemaProperty,
  type JSONSchemaTypeName,
} from './defineMaterial';
export { MaterialRegistry, materialRegistry } from './registry';
export {
  toLegacyComponentMeta,
  propsSchemaToLegacy,
  deriveDefaultProps,
} from './compat';
