import type { PageSchema } from './schema';

/**
 * Reorder root.children (for design-time Sortable onEnd).
 * Mutates schema in place for reactivity.
 */
export function reorderRootChildren(
  schema: PageSchema,
  fromIndex: number,
  toIndex: number
): void {
  const children = schema.root.children ?? [];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= children.length ||
    toIndex >= children.length
  )
    return;
  const [removed] = children.splice(fromIndex, 1);
  children.splice(toIndex, 0, removed);
}
