import type { Component } from "vue";

/**
 * 路由项：path 为模式（与 Vue Router 风格一致），component 为懒加载组件
 */
export interface RouteRecord {
  path: string;
  name?: string;
  component: () => Promise<{ default: Component }>;
}

/**
 * 路由配置：通过配置 + import 组件的方式组织 URL。
 * 按顺序匹配，第一个匹配的生效。
 */
export const routes: RouteRecord[] = [
  {
    path: "/",
    name: "home",
    component: () => import("~/views/Home.vue"),
  },
  {
    path: "/:site/:path*",
    name: "page",
    component: () => import("~/views/DynamicPage.vue"),
  },
];

export interface ResolvedRoute {
  route: RouteRecord;
  params: Record<string, string>;
}

/**
 * 根据当前路径解析出匹配的路由与参数
 */
export function resolveRoute(currentPath: string): ResolvedRoute | null {
  const normalized = currentPath.replace(/^\/+|\/+$/g, "") || "";
  // 根路径 -> home
  if (normalized === "") {
    const home = routes[0];
    if (home) return { route: home, params: {} };
    return null;
  }
  const segments = normalized.split("/").filter(Boolean);
  // /:site 或 /:site/:path* -> page
  if (segments.length >= 1) {
    const pageRoute = routes[1];
    if (!pageRoute) return null;
    const site = segments[0];
    const path = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
    return { route: pageRoute, params: { site, path } };
  }
  return null;
}
