import type { RouterConfig } from "@nuxt/schema";
import type { RouteRecordRaw } from "vue-router";
import { routes as appRoutes } from "~/router/routes";

function toVueRoutes(): RouteRecordRaw[] {
  return appRoutes.map((r) => ({
    path: r.path,
    name: r.name,
    component: r.component,
  }));
}

export default <RouterConfig>{
  routes: () => toVueRoutes(),
};

