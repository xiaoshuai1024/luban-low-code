// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  typescript: {
    strict: true,
  },
  runtimeConfig: {
    public: {
      /** BFF 基地址，请求公开接口时使用，如 https://bff.example.com */
      bffBaseUrl: process.env.NUXT_PUBLIC_BFF_BASE_URL || "http://127.0.0.1:3000",
      /** 单站点模式下的默认站点 slug，请求页面时固定使用 */
      defaultSiteSlug: process.env.NUXT_PUBLIC_DEFAULT_SITE_SLUG || "default",
    },
  },
  vite: {
    optimizeDeps: {
      include: ["luban-low-code", "luban-base"],
    },
  },
});
