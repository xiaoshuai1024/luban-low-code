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
  // === V2 设计器 v2 FeatureGate（§5.3）===
  readonly VITE_FEATURE_RESPONSIVE?: string
  readonly VITE_FEATURE_ANIMATION?: string
  readonly VITE_FEATURE_SEO?: string
  readonly VITE_FEATURE_TEMPLATES?: string
  readonly VITE_FEATURE_CMS?: string
  readonly VITE_FEATURE_FORMS?: string
  readonly VITE_FEATURE_VERSION_HISTORY?: string
  readonly VITE_FEATURE_EXPORT?: string
  readonly VITE_FEATURE_ANALYTICS?: string
  readonly VITE_FEATURE_MULTI_SELECT?: string
  readonly VITE_FEATURE_ALIGN_GUIDES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
