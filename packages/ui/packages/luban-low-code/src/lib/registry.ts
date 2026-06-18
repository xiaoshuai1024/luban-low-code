/**
 * registry — Vue 组件来源（向后兼容 getComponent/registerComponent）。
 *
 * @migration 13+1 物料 schema 重构（聚合收口，0.1.0）
 *
 * 组件来源分层：
 *  1. materialRegistry：若 `materials/` 已注册某 name，则其 `.component`
 *     字段即为该物料的 Vue 组件实现（优先）；
 *  2. fallback 硬编码 luban-base 映射：作为 registry 未注册时的兜底，
 *     同时是 form B 组物料在定义期（defineMaterial 调用时）取组件的来源。
 *
 * 关键循环依赖说明：
 *  - 本文件 import 的是 `./material/registry`（foundation 层 MaterialRegistry
 *    单例），**不** import `../materials`（聚合层），避免与 form 物料形成
 *    `registry → materials → registry` 循环。
 *  - materials 聚合层的注册（side-effect）由包入口 `src/index.ts` 的
 *    `import './materials'` 触发，保证 getComponent 被实际调用前 registry 已就绪。
 *
 * @since 0.1.0
 */

import type { Component } from 'vue';
import {
  LubanButton,
  LubanContainer,
  LubanRow,
  LubanCol,
  LubanBanner,
  LubanText,
  LubanForm,
  LubanInput,
  LubanTextArea,
  LubanSelect,
  LubanCheckbox,
  LubanRadioGroup,
  LubanSwitch,
} from 'luban-base';
import { materialRegistry } from './material/registry';

/**
 * 硬编码兜底组件映射（luban-base 直引）。
 *
 * 用途：
 *  - form B 组物料定义期取组件的来源（materials/form 下各 material.ts
 *    在模块求值期调用 getComponent('LubanInput')，此时 materialRegistry
 *    尚未注册该 name，需 fallback 提供 Vue 组件）；
 *  - materialRegistry 未覆盖某 name 时的防御性兜底；
 *  - 接收运行时 registerComponent 写入的自定义覆盖。
 */
const fallbackRegistry: Record<string, Component> = {
  LubanButton,
  LubanContainer,
  LubanRow,
  LubanCol,
  LubanBanner,
  LubanText,
  LubanForm,
  LubanInput,
  LubanTextArea,
  LubanSelect,
  LubanCheckbox,
  LubanRadioGroup,
  LubanSwitch,
};

/**
 * 按类型取 Vue 组件。
 *
 * 查找顺序：
 *  1. materialRegistry.get(name)?.component（若 registry 已注册该物料）；
 *  2. fallbackRegistry[name]（硬编码 luban-base + 运行时 registerComponent 写入）；
 *  3. undefined。
 *
 * @example
 * ```ts
 * const Comp = getComponent('LubanButton');
 * // Comp 即 luban-base 的 LubanButton Vue 组件
 * ```
 */
export function getComponent(type: string): Component | undefined {
  const def = materialRegistry.get(type);
  if (def?.component) {
    return def.component;
  }
  return fallbackRegistry[type];
}

/**
 * 注册/覆盖组件（运行时扩展入口，向后兼容）。
 *
 * 写入 fallbackRegistry；若 materialRegistry 已注册同名物料，getComponent
 * 优先返回 materialRegistry 的 component（即本函数不影响已注册物料，
 * 仅扩展 fallback 映射）。如需替换物料组件，请通过 materialRegistry
 * unregister + register。
 */
export function registerComponent(type: string, component: Component): void {
  fallbackRegistry[type] = component;
}
