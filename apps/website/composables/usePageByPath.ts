import type { MaybeRefOrGetter } from "vue";
import { toValue, computed } from "vue";
import type { PublicPagePayload } from "~/types/page";

/**
 * 根据站点 slug 与路径从 BFF 公开接口获取已发布页面数据（含 schema）。
 * 支持响应式参数（Ref/Computed），参数变化时会重新请求。
 */
export function usePageByPath(siteSlug: MaybeRefOrGetter<string>, path: MaybeRefOrGetter<string>) {
  const config = useRuntimeConfig().public;
  const bffBase = (config.bffBaseUrl as string)?.replace(/\/$/, "") || "";
  const key = computed(() => {
    const slug = toValue(siteSlug);
    const p = toValue(path);
    const pathNorm = p.startsWith("/") ? p : `/${p}`;
    return `page:${slug}:${pathNorm}`;
  });
  const url = computed(() => {
    const slug = toValue(siteSlug);
    const p = toValue(path);
    const pathNorm = p.startsWith("/") ? p : `/${p}`;
    return `${bffBase}/api/public/sites/${encodeURIComponent(slug)}/pages/by-path?path=${encodeURIComponent(pathNorm)}`;
  });
  return useFetch<PublicPagePayload>(url, {
    key,
    getCachedData: (k) => useNuxtData(k).data.value,
  });
}
