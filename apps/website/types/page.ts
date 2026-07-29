import type { PageSchema, PageSeo } from "@luban-low-code/luban-low-code";

/**
 * BFF 公开接口返回的页面数据（已发布页面，含 schema）
 *
 * V2-T2：新增 seo 字段（页面级 SEO，website 注入 useSeoMeta）。
 * 与 PageSchema.seo 同步；后端公开端点下发。
 */
export interface PublicPagePayload {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status: string;
  schema: PageSchema;
  /** V2-T2 页面级 SEO（公开端点下发，可能为空） */
  seo?: PageSeo;
  createdAt?: string;
  updatedAt?: string;
}
