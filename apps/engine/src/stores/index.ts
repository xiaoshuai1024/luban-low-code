export { useUserStore } from './user'
export { useSiteStore } from './site'
export { useAiStore } from './ai'
// usePageStore (stores/page.ts) 已移除：currentSchema/setCurrentSchema 全工程零调用，
// 是 plan 提到的「stores/page.ts 与 PageEditor 局部 schema 分裂隐患」根源。
// schema SSOT 收敛到 PageEditor 局部 ref + usePageEditorApi（plan P1-T8）。
