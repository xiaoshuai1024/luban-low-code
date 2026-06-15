// Type declarations for luban-low-code package (linked via pnpm override)
// The package is built via NX in the luban-ui monorepo.
// These minimal types satisfy vue-tsc compilation.

declare module 'luban-low-code' {
  import type { DefineComponent } from 'vue'

  /** Design mode — drag-and-drop page designer */
  export const LubanDesigner: DefineComponent<{
    modelValue?: unknown
    materialGroups?: unknown[]
    registry?: unknown
  }>

  /** Runtime page renderer */
  export const LubanPage: DefineComponent

  /** Runtime single-node renderer */
  export const RuntimeRenderer: DefineComponent<{
    node?: unknown
    registry?: unknown
  }>

  /** Material registry helper */
  export const createMaterialRegistry: () => unknown
}
