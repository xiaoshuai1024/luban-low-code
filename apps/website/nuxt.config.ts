// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  pages: true,
  modules: ["@pinia/nuxt"],
  typescript: { strict: true },
  // GitHub Pages 子路径：https://user.github.io/luban-low-code/
  app: {
    baseURL: process.env.NODE_ENV === 'production' ? '/luban-low-code/' : '/',
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      titleTemplate: "%s",
      htmlAttrs: { lang: "zh-CN" },
      meta: [{ name: "format-detection", content: "telephone=no" }],
      style: [
        "html{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1e293b;line-height:1.6}body{font-family:inherit;color:inherit;line-height:inherit}",
      ],
    },
  },
  runtimeConfig: {
    public: {
      bffBaseUrl: process.env.NUXT_PUBLIC_BFF_BASE_URL || "http://127.0.0.1:3100",
      defaultSiteSlug: process.env.NUXT_PUBLIC_DEFAULT_SITE_SLUG || "default",
    },
  },
  css: [
    fileURLToPath(new URL("../../packages/ui/packages/luban-low-code/dist/index.css", import.meta.url)),
  ],
  vite: {
    resolve: {
      alias: {
        "luban-base": fileURLToPath(new URL("../../packages/ui/packages/luban-base/dist/index.js", import.meta.url)),
        "luban-low-code": fileURLToPath(new URL("../../packages/ui/packages/luban-low-code/dist/index.js", import.meta.url)),
      },
    },
    optimizeDeps: { exclude: ["luban-low-code", "luban-base"] },
  },
});
