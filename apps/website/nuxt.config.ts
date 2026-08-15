// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  pages: true,
  modules: ["@pinia/nuxt"],
  typescript: { strict: true },
  // baseURL：NUXT_APP_BASE_URL 显式优先（Docker 生产构建传 /，根域名部署）。
  // 未设置时保留 GitHub Pages 子路径默认（https://user.github.io/luban-low-code/）。
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || (process.env.NODE_ENV === 'production' ? '/luban-low-code/' : '/'),
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
  nitro: {
    prerender: {
      // /docs/ 与 /storybook/ 是部署后由独立静态目录提供的外部站点路径，
      // Nuxt 爬虫不应预渲染它们（否则 404 会中断 nuxi generate）
      ignore: ["/docs", "/storybook"],
      // 兜底：多站点合并部署时，任何残留外部链接 404 不应阻断生成
      failOnError: false,
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
