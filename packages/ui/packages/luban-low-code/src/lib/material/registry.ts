/**
 * MaterialRegistry — 物料注册中心（foundation）。
 *
 * 管理所有通过 defineMaterial 声明的物料。13 物料迁移完成后，
 * 旧 componentMeta.ts/buildDefaultMeta 将由本注册中心派生（见 ./compat.ts）。
 *
 * 设计：模块级单例（本模块导出的 `materialRegistry`），避免在低代码运行时
 * 维护多实例造成的注册漂移。单元测试若需隔离，可 new MaterialRegistry()。
 *
 * @since 0.1.0
 */

import type { MaterialDefinition } from './defineMaterial';

/**
 * 物料注册中心。
 *
 * 提供：
 *  - register(def)  注册物料，name 重复时 throw；
 *  - get(name)      按唯一 name 取物料；
 *  - getAll()       取全部物料（数组）；
 *  - getByCategory(cat) 按分类过滤。
 */
export class MaterialRegistry {
  private readonly defs = new Map<string, MaterialDefinition>();

  /**
   * 注册物料。
   *
   * name 必须唯一；重复注册（同名）抛错，避免静默覆盖导致设计器取到错误物料。
   * 如需覆盖，请先显式调用 unregister。
   */
  register(def: MaterialDefinition): MaterialDefinition {
    if (this.defs.has(def.name)) {
      throw new Error(
        `[luban-low-code] MaterialRegistry.register: duplicate material name "${def.name}"`
      );
    }
    this.defs.set(def.name, def);
    return def;
  }

  /** 按唯一 name 取物料；未注册返回 undefined。 */
  get(name: string): MaterialDefinition | undefined {
    return this.defs.get(name);
  }

  /** 判断 name 是否已注册。 */
  has(name: string): boolean {
    return this.defs.has(name);
  }

  /** 取所有已注册物料（拷贝，避免外部 mutate 内部 Map）。 */
  getAll(): MaterialDefinition[] {
    return Array.from(this.defs.values());
  }

  /** 按分类取物料（大小写敏感精确匹配 category 字段）。 */
  getByCategory(category: string): MaterialDefinition[] {
    return this.getAll().filter((d) => d.category === category);
  }

  /** 注销物料（主要用于测试隔离或物料热替换）。 */
  unregister(name: string): boolean {
    return this.defs.delete(name);
  }

  /** 已注册物料数量。 */
  get size(): number {
    return this.defs.size;
  }
}

/**
 * 默认模块级单例。
 *
 * 13 物料迁移期间：物料在各自 materials/<category>/<name>/index.ts 中
 * 调用 `materialRegistry.register(defineMaterial({...}))` 完成注册。
 */
export const materialRegistry = new MaterialRegistry();
