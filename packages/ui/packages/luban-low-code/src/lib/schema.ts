/**
 * Node in the page tree; type refers to a registered component (e.g. LubanButton, LubanInput).
 */
export interface NodeSchema {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: NodeSchema[];
  /** 条件渲染：表达式字符串(沙箱 evaluate 求值)或字面布尔；undefined/缺省 = true */
  visible?: string | boolean;
  /** 循环渲染：data 为表达式(求值为数组)或字面量数组，按元素多次渲染本节点 */
  loop?: NodeLoop;
  /** 事件绑定：事件名 → 动作表达式(沙箱求值，如 "navigate('/x')")；运行时由 RuntimeRenderer 解析 */
  events?: Record<string, string>;
  /** 数据源绑定：运行时拉取数据并以 varName 注入表达式上下文 */
  datasource?: NodeDatasource;
  /** 编辑态锁定：设计器中禁止拖拽/删除/改属性（不影响运行态渲染） */
  locked?: boolean;
  /** 编辑态隐藏：设计器不渲染但保留 schema（区别于运行态 visible） */
  hidden?: boolean;
  /**
   * 节点级自定义样式（CSS 属性 → 值，如 { backgroundColor:'#fff', fontSize:'16px' }）。
   * 设计态由 PropertyPanel 样式分区写入；DesignRenderer 在 wrapper div 绑 :style，
   * RuntimeRenderer 经 componentProps 注入到组件根（inheritAttrs 透传）。
   * 值在写入前由 PropertyPanel 做安全过滤（拒绝 expression()/javascript: 等危险协议）。
   * V2-T4: 本字段作为 desktop（默认）断点的样式；tablet/mobile 在 node.responsive 覆盖。
   */
  style?: Record<string, string>;
  /** 节点级自定义 class（空格分隔），与 style 一样由属性面板配置。 */
  className?: string;
  /**
   * V2-T4 响应式：per-breakpoint style 覆盖。
   * desktop 为默认（用 node.style），tablet/mobile 浅合并覆盖 desktop。
   * 渲染时 resolveResponsiveProps 按 desktop→tablet→mobile 折叠，
   * SSR 输出三断点 @media CSS。
   */
  responsive?: NodeResponsive;
  /**
   * V2-T5 动画：入场/hover/scroll 触发的过渡动画。
   * 渲染器注入 @keyframes CSS；trigger 决定触发时机。
   * 无 animation 字段时不输出任何 CSS（零开销）。
   */
  animation?: NodeAnimation;
  /**
   * V2-T7 CMS 绑定：把该节点绑定到一个 collection 的字段，
   * 运行态由 host（website）拉取 collection items 并把字段值注入组件 props。
   * 设计态（engine）用 mock 数据预览。
   */
  cmsBinding?: NodeCmsBinding;
}

/**
 * V2-T7 节点 CMS 绑定配置。
 * collectionId + fieldKey 决定从哪个 collection 的哪个字段取值。
 * mode：'single'（取首条 item 的字段值）/ 'list'（整个 items 数组注入，供列表组件循环）。
 */
export interface NodeCmsBinding {
  collectionId: string;
  /** single 模式：取 item[fieldKey]；list 模式：忽略，注入整个 items */
  fieldKey?: string;
  mode?: 'single' | 'list';
  /** 排序字段（默认 updatedAt） */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 限制条数（list 模式，默认全部） */
  limit?: number;
}

/**
 * V2-T5 节点动画配置。
 * type 映射预定义 @keyframes；trigger 区分触发时机。
 */
export interface NodeAnimation {
  /** 动画类型 */
  type?: AnimationType;
  /** 持续时间（ms） */
  duration?: number;
  /** 延迟（ms） */
  delay?: number;
  /** CSS 缓动函数（如 ease/ease-in-out/cubic-bezier(...)） */
  easing?: string;
  /** 触发时机 */
  trigger?: AnimationTrigger;
  /** scroll 触发时是否每次进入视口重播（默认 false 只播一次） */
  scrollRepeat?: boolean;
}

export type AnimationType = 'fade' | 'slide-up' | 'slide-left' | 'zoom' | 'flip';
export type AnimationTrigger = 'in-view' | 'hover' | 'load';

/**
 * V2-T4 节点响应式样式覆盖。
 * 每个断点为 CSS 属性 → 值的浅合并覆盖（非深合并）。
 */
export interface NodeResponsive {
  /** 平板断点（768-1023px）覆盖 desktop */
  tablet?: Record<string, string>;
  /** 手机断点（<768px）覆盖 desktop+tablet */
  mobile?: Record<string, string>;
}

/** V2-T4 断点枚举（设计态 + 运行态统一） */
export type ResponsiveBreakpoint = 'desktop' | 'tablet' | 'mobile';

/** 循环渲染配置 */
export interface NodeLoop {
  /** 表达式(求值为数组)或字面量数组 */
  data: string | unknown[];
  /** 单元素在表达式上下文中的变量名，默认 "item" */
  itemVar?: string;
  /** 元素索引变量名，默认 "index" */
  keyVar?: string;
}

/** 节点数据源绑定配置 */
export interface NodeDatasource {
  /** datasource 实体 id（指向后端 datasources 表） */
  id: string;
  /** 拉取结果在表达式上下文中的变量名 */
  varName: string;
  /** 查询参数（可为表达式字符串，运行时求值） */
  params?: Record<string, unknown>;
}

/**
 * Page schema: root node + optional form state for value bindings.
 */
export interface PageSchema {
  root: NodeSchema;
  formState?: Record<string, unknown>;
  /** V2-T2 SEO 元信息（页面级，SSR 注入 useSeoMeta） */
  seo?: PageSeo;
}

/**
 * V2-T2 页面级 SEO 元信息。
 *
 * 归属 low-code PageSchema（engine 透明消费、website 注入）。
 * 所有字段可选；后端 seo_json JSON 列承载同名结构。
 */
export interface PageSeo {
  /** <title> 与 og:title */
  title?: string;
  /** meta description / og:description */
  description?: string;
  /** meta keywords（部分搜索引擎仍消费） */
  keywords?: string[];
  /** og:title 覆盖（不填回退 title） */
  ogTitle?: string;
  /** og:description 覆盖（不填回退 description） */
  ogDescription?: string;
  /** og:image 绝对/相对 URL */
  ogImage?: string;
  /** canonical link */
  canonical?: string;
  /** noindex：true 时 robots 设 noindex,nofollow */
  noIndex?: boolean;
}
