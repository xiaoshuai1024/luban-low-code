/**
 * 组件类型常量（容器类型 / 表单控件类型）。
 *
 * @migration 13+1 物料 schema 重构（聚合收口，0.1.0）
 *
 * 重构后 CONTAINER_TYPES / FORM_CONTROL_TYPES 从 materialRegistry 动态派生：
 *  - CONTAINER_TYPES = materialRegistry 中 isContainer===true 的物料 name 集合；
 *  - FORM_CONTROL_TYPES = category==='form' 且非 LubanForm 的物料 name 集合
 *    （6 个表单控件：Input/TextArea/Select/Checkbox/RadioGroup/Switch）。
 *
 * 为保持与历史 `export const CONTAINER_TYPES = new Set(...)` 语义一致
 * （顶层 const、可同步访问），本文件在模块求值期立即触发 materials 聚合层
 * 注册：通过顶层 `import '../materials'` 的 side-effect 完成 registry 填充，
 * 随后同步派生两个 Set。
 *
 * @since 0.1.0
 */

// 顶层 side-effect import：确保 materialRegistry 在派生常量前已注册全部 14 物料。
// materials 聚合层只触发一次（ESM 模块缓存），后续 import 复用。
import '../materials';
import { materialRegistry } from './material/registry';

/**
 * 容器类型集合：所有 isContainer===true 的物料 name。
 *
 * 覆盖：LubanContainer / LubanRow / LubanCol / LubanForm / LubanSidePanel。
 */
export const CONTAINER_TYPES = new Set<string>(
  materialRegistry
    .getAll()
    .filter((def) => def.isContainer === true)
    .map((def) => def.name)
);

export function isContainerType(type: string): boolean {
  return CONTAINER_TYPES.has(type);
}

/**
 * 表单控件类型集合：category==='form' 且非容器型（排除 LubanForm）的物料。
 *
 * 覆盖 6 个控件：LubanInput / LubanTextArea / LubanSelect /
 * LubanCheckbox / LubanRadioGroup / LubanSwitch。
 *
 * 该集合与 LubanForm.acceptTypes 应保持一致（见 materials/form/form/material.ts）。
 */
export const FORM_CONTROL_TYPES = new Set<string>(
  materialRegistry
    .getAll()
    .filter((def) => def.category === 'form' && def.isContainer !== true)
    .map((def) => def.name)
);

/**
 * Whether a child type can be dropped into a container type.
 * If acceptTypes is not defined for the container, any registered type is allowed.
 */
export function canAcceptChild(
  containerType: string,
  childType: string,
  getAcceptTypes: (type: string) => string[] | undefined
): boolean {
  if (!CONTAINER_TYPES.has(containerType)) return false;
  const accept = getAcceptTypes(containerType);
  if (accept == null || accept.length === 0) return true;
  return accept.includes(childType);
}
