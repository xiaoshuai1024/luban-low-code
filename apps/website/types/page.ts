import type { PageSchema } from "luban-low-code";

/**
 * BFF 公开接口返回的页面数据（已发布页面，含 schema）
 */
export interface PublicPagePayload {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status: string;
  schema: PageSchema;
  createdAt?: string;
  updatedAt?: string;
}
