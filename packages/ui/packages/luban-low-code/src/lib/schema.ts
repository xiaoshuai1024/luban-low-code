/**
 * Node in the page tree; type refers to a registered component (e.g. LubanButton, LubanInput).
 */
export interface NodeSchema {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: NodeSchema[];
}

/**
 * Page schema: root node + optional form state for value bindings.
 */
export interface PageSchema {
  root: NodeSchema;
  formState?: Record<string, unknown>;
}
