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
}

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
}
