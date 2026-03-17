import type { PublicPagePayload } from "~/types/page";

/**
 * 根据站点 slug 与路径从 BFF 公开接口获取已发布页面数据（含 schema）
 */
export function usePageByPath(siteSlug: string, path: string) {
  const config = useRuntimeConfig().public;
  const bffBase = (config.bffBaseUrl as string)?.replace(/\/$/, "") || "";
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const url = `${bffBase}/api/public/sites/${encodeURIComponent(siteSlug)}/pages/by-path?path=${encodeURIComponent(pathNorm)}`;

  return useFetch<PublicPagePayload>(url, {
    key: `page:${siteSlug}:${pathNorm}`,
    getCachedData: (key) => useNuxtData(key).data.value,
  });
}
