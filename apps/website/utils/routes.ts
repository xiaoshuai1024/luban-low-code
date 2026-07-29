/**
 * 集中管理路由路径，供 navigateTo / useRouter 使用。
 * 与 pages/[[site]]/[[...path]].vue 的约定一致。
 */

/** 默认站点 slug（与 nuxt.config runtimeConfig.public.defaultSiteSlug 对齐） */
export const DEFAULT_SITE_SLUG = "default";

/**
 * 站点下某页面的路径（用于 Nuxt 文件路由 [[site]]/[[...path]]）
 * @param siteSlug 站点 slug
 * @param path 页面 path，如 "/" 或 "/about"；缺省为首页
 */
export function pagePath(siteSlug: string, path?: string): string {
  const p = path === undefined || path === "" || path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  const base = `/${siteSlug}`;
  return p ? `${base}${p}` : `${base}/`;
}

/**
 * 站点首页路径
 * @param siteSlug 站点 slug，缺省为 DEFAULT_SITE_SLUG
 */
export function homePath(siteSlug?: string): string {
  const slug = siteSlug ?? DEFAULT_SITE_SLUG;
  return `/${slug}/`;
}
