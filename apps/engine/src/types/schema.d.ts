export interface NodeSchema {
  id: string
  type: string
  props?: Record<string, unknown>
  children?: NodeSchema[]
  eventBindings?: Record<string, string>
}

export interface PageSchema {
  root: NodeSchema
  formState?: Record<string, unknown>
}
