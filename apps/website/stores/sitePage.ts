import { defineStore } from "pinia";
import type { PublicPagePayload } from "~/types/page";

export const useSitePageStore = defineStore("sitePage", {
  state: () => ({
    currentSiteSlug: "" as string,
    currentPath: "" as string,
    currentPage: null as PublicPagePayload | null,
    error: null as Error | null,
  }),

  getters: {
    schema: (state) => state.currentPage?.schema ?? null,
    pageName: (state) => state.currentPage?.name ?? "",
  },

  actions: {
    setPage(siteSlug: string, path: string, payload: PublicPagePayload | null, err: Error | null = null) {
      this.currentSiteSlug = siteSlug;
      this.currentPath = path;
      this.currentPage = payload;
      this.error = err;
    },

    clearPage() {
      this.currentSiteSlug = "";
      this.currentPath = "";
      this.currentPage = null;
      this.error = null;
    },
  },
});
