/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  // === FeatureGate（D15-D1）：默认全开，env='false'/'0' 关闭 ===
  readonly VITE_FEATURE_STYLE?: string
  readonly VITE_FEATURE_DATASOURCE_MANAGE?: string
  readonly VITE_FEATURE_TEST_CONNECT?: string
  readonly VITE_FEATURE_TREE_LOCK_HIDE?: string
  readonly VITE_FEATURE_EVENTS?: string
  readonly VITE_FEATURE_DATASOURCE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
