import type { Component } from "vue";

export interface RouteRecord {
  path: string;
  name?: string;
  component: () => Promise<{ default: Component }>;
}

/**
 * All pages are built through the Luban platform (visual builder → PageSchema → LubanPage).
 * No hand-written page code allowed.
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

export function resolveRoute(currentPath: string): ResolvedRoute | null {
  const normalized = currentPath.replace(/^\/+|\/+$/g, "") || "";
  if (normalized === "") {
    return { route: routes[0], params: {} };
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length >= 1) {
    const pageRoute = routes[1];
    if (!pageRoute) return null;
    const site = segments[0];
    const path = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
    return { route: pageRoute, params: { site, path } };
  }
  return null;
}
