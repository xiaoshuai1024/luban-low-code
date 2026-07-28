/**
 * V2-T7 CMS 绑定解析（纯函数）。
 *
 * resolveCmsProps：按 NodeCmsBinding 把 collection items 注入组件 props。
 *  - single 模式：取排序后首条 item[fieldKey]，注入到指定 prop（默认 'content'）。
 *  - list 模式：items 数组注入到指定 prop（默认 'items'）。
 *
 * host（website）负责拉取 collection items 后调用本函数；
 * engine 设计态用 mock items 预览（见 PropertyPanel/cmsBinding 分区）。
 */
import type { NodeCmsBinding } from './schema';

/** collection item 的 data 是自由结构 { [fieldKey]: unknown }。 */
export interface CollectionItemData {
  [fieldKey: string]: unknown;
}

/** 带元信息的 item（host 拉取后传入） */
export interface ResolvedCollectionItem {
  id: string;
  data: CollectionItemData;
  updatedAt?: string;
}

/** 排序 + limit 裁剪（纯函数） */
export function sortAndLimitItems(
  items: ResolvedCollectionItem[],
  binding: NodeCmsBinding
): ResolvedCollectionItem[] {
  const sortBy = binding.sortBy ?? 'updatedAt';
  const order = binding.sortOrder ?? 'desc';
  const sorted = [...items].sort((a, b) => {
    const av = sortBy === 'updatedAt' ? a.updatedAt : (a.data[sortBy] as string | number | undefined);
    const bv = sortBy === 'updatedAt' ? b.updatedAt : (b.data[sortBy] as string | number | undefined);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return order === 'asc' ? av - bv : bv - av;
    }
    const as = String(av);
    const bs = String(bv);
    return order === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });
  return binding.limit && binding.limit > 0 ? sorted.slice(0, binding.limit) : sorted;
}

/**
 * 按 binding 把 items 解析为应注入组件的 props。
 *  - single：{ [injectProp]: firstItem.data[fieldKey] }
 *  - list：{ [injectProp]: items.map(i => i.data) }
 *
 * @param binding 节点绑定配置
 * @param items 已拉取的 collection items（未排序；内部排序裁剪）
 * @param injectProp 注入到哪个 prop 名（single 默认 'content'，list 默认 'items'）
 * @returns 注入 props 对象（与 node.props 浅合并；空 binding 返回 {}）
 */
export function resolveCmsProps(
  binding: NodeCmsBinding | undefined,
  items: ResolvedCollectionItem[],
  injectProp?: string
): Record<string, unknown> {
  if (!binding || !binding.collectionId) return {};
  const sorted = sortAndLimitItems(items, binding);
  const mode = binding.mode ?? 'single';
  if (mode === 'list') {
    const prop = injectProp ?? 'items';
    return { [prop]: sorted.map((i) => i.data) };
  }
  // single
  const prop = injectProp ?? 'content';
  const first = sorted[0];
  const fieldKey = binding.fieldKey ?? 'content';
  return { [prop]: first ? first.data[fieldKey] : '' };
}

/**
 * 收集 schema 树中所有 cmsBinding 引用的 collectionId（去重）。
 * host 用此决定拉取哪些 collection。
 */
export function collectBoundCollectionIds(root: {
  cmsBinding?: NodeCmsBinding;
  children?: unknown[];
}): string[] {
  const ids = new Set<string>();
  function walk(node: { cmsBinding?: NodeCmsBinding; children?: unknown[] }): void {
    if (node.cmsBinding?.collectionId) {
      ids.add(node.cmsBinding.collectionId);
    }
    if (node.children) {
      for (const c of node.children) {
        walk(c as { cmsBinding?: NodeCmsBinding; children?: unknown[] });
      }
    }
  }
  walk(root);
  return Array.from(ids);
}
