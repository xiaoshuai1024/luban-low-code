// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  pages: true,
  modules: ["@pinia/nuxt"],
  typescript: {
    strict: true,
  },
  // V2-T2 默认 head：viewport / charset / titleTemplate；页面级 useSeoMeta 可覆盖
  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      titleTemplate: "%s",
      htmlAttrs: { lang: "zh-CN" },
      meta: [
        { name: "format-detection", content: "telephone=no" },
      ],
    },
  },
  runtimeConfig: {
    public: {
      /** BFF 基地址，请求公开接口时使用，如 https://bff.example.com */
      bffBaseUrl: process.env.NUXT_PUBLIC_BFF_BASE_URL || "http://127.0.0.1:3100",
      /** 单站点模式下的默认站点 slug，请求页面时固定使用 */
      defaultSiteSlug: process.env.NUXT_PUBLIC_DEFAULT_SITE_SLUG || "default",
    },
  },
  vite: {
    resolve: {
      // luban-base/luban-low-code 的 exports 条件在 nuxt nitro SSR commonjs resolver 下解析失败，
      // 显式 alias 指向 dist 入口绕过（依赖 packages/ui 先 nx build 产出 dist）。
      alias: {
        "luban-base": fileURLToPath(
          new URL("../../packages/ui/packages/luban-base/dist/index.js", import.meta.url),
        ),
        "luban-low-code": fileURLToPath(
          new URL("../../packages/ui/packages/luban-low-code/dist/index.js", import.meta.url),
        ),
      },
    },
    optimizeDeps: {
      include: ["luban-low-code", "luban-base"],
    },
  },
});
