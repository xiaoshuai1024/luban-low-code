/**
 * materials barrel — 14 物料统一注册入口（聚合收口层）。
 *
 * 职责：
 *  1. import 全部 14 个 material 定义（side-effect + re-export）；
 *  2. 调用 `materialRegistry.register(...)` 将每个物料纳入 registry；
 *  3. 导出 `materials` 数组与各 material 常量，供下游（registry/palette/
 *     componentMeta）经 registry 派生旧 ComponentMeta。
 *
 * 注册容错：重复注册（如热重载/测试隔离多次 import 本模块）会先 unregister
 * 再 register，避免 MaterialRegistry.register 抛 "duplicate name"。
 *
 * @since 0.1.0
 */

import { materialRegistry } from '../lib/material/registry';
import type { MaterialDefinition } from '../lib/material/defineMaterial';

// === general 组 ===
import { buttonMaterial } from './general/button/material';
// === content 组 ===
import { bannerMaterial } from './content/banner/material';
// === layout 组（含首次纳入的 SidePanel）===
import { containerMaterial } from './layout/container/material';
import { rowMaterial } from './layout/row/material';
import { colMaterial } from './layout/col/material';
import { sidePanelMaterial } from './layout/side-panel/material';
// === form 组 ===
import { formMaterial } from './form/form/material';
import { inputMaterial } from './form/input/material';
import { textAreaMaterial } from './form/textarea/material';
import { selectMaterial } from './form/select/material';
import { checkboxMaterial } from './form/checkbox/material';
import { radioGroupMaterial } from './form/radio-group/material';
import { switchMaterial } from './form/switch/material';
// === general/text（与 button 同组，import 分组保持文件来源可读）===
import { textMaterial } from './general/text/material';

/**
 * 全部 14 物料定义（注册顺序：general → content → layout → form）。
 *
 * 顺序仅影响 palette 默认展示顺序的稳定性，不影响 registry 行为
 *（registry 内部用 Map，按 name 索引）。
 */
export const materials: MaterialDefinition[] = [
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
];

/**
 * 把物料注册到 materialRegistry（容错重复注册）。
 *
 * @internal 仅在本模块初始化时调用一次；多次 import 本模块时该函数
 * 可能被多次执行（ESM 模块缓存下通常只执行一次，但测试隔离/热重载场景
 * 可能重复），故用 unregister-first 策略保证幂等。
 */
function registerAll(): void {
  for (const def of materials) {
    if (materialRegistry.has(def.name)) {
      materialRegistry.unregister(def.name);
    }
    materialRegistry.register(def);
  }
}

// 模块加载即注册（side-effect）：只要本模块被 import 一次，registry 即就绪。
registerAll();

// === re-export 各 material 常量（下游可按需引用具体物料）===
export { buttonMaterial } from './general/button/material';
export { textMaterial } from './general/text/material';
export { bannerMaterial } from './content/banner/material';
export { containerMaterial } from './layout/container/material';
export { rowMaterial } from './layout/row/material';
export { colMaterial } from './layout/col/material';
export { sidePanelMaterial } from './layout/side-panel/material';
export { formMaterial } from './form/form/material';
export { inputMaterial } from './form/input/material';
export { textAreaMaterial } from './form/textarea/material';
export { selectMaterial } from './form/select/material';
export { checkboxMaterial } from './form/checkbox/material';
export { radioGroupMaterial } from './form/radio-group/material';
export { switchMaterial } from './form/switch/material';
