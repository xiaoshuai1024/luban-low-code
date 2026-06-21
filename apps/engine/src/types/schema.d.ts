/**
 * NodeSchema / PageSchema 双定义收口（第1波 W1-T1）。
 *
 * 历史问题：engine 曾在本地 @/types/schema 副本声明 NodeSchema（含 eventBindings），
 * 与 luban-low-code 导出版本 drift。第1波统一为 single source：本文件仅 re-export
 * luban-low-code 的类型，新增字段（visible/loop/events/datasource/locked/hidden）
 * 由 luban-low-code 维护，engine 消费。
 *
 * eventBindings（engine 旧字段）已统一为 events，全仓零代码消费（仅历史注释）。
 */
export type {
  NodeSchema,
  PageSchema,
  NodeLoop,
  NodeDatasource,
  PageSeo,
  NodeResponsive,
  ResponsiveBreakpoint,
} from 'luban-low-code';
