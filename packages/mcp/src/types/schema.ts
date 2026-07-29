/** Minimal page schema for the low-code platform */
export interface PageSchema {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  /** Root-level nodes composing the page */
  nodes: NodeSchema[];
  /** Arbitrary page-level props */
  props?: Record<string, unknown>;
  /** Template identifier if based on a template */
  template?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Minimal node schema representing a component in the render tree */
export interface NodeSchema {
  /** Unique node identifier */
  id: string;
  /** Component type name, e.g. "Button", "Container" */
  type: string;
  /** Props passed to the component */
  props?: Record<string, unknown>;
  /** Child nodes */
  children?: NodeSchema[];
  /** Named slots for multi-slot components */
  slots?: Record<string, NodeSchema[]>;
}
