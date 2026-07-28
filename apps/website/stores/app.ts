import { defineStore } from "pinia";

export type Theme = "light" | "dark";

export const useAppStore = defineStore("app", {
  state: () => ({
    theme: "light" as Theme,
    sidebarOpen: true,
    userPreferences: {} as Record<string, unknown>,
  }),

  actions: {
    setTheme(value: Theme) {
      this.theme = value;
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    setSidebarOpen(open: boolean) {
      this.sidebarOpen = open;
    },

    setPreference(key: string, value: unknown) {
      this.userPreferences = { ...this.userPreferences, [key]: value };
    },
  },
});
