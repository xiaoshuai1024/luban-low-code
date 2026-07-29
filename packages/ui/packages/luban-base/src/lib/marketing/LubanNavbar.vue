<script setup lang="ts">
withDefaults(
  defineProps<{
    brand?: string;
    links?: Array<{ label: string; url: string }>;
    backgroundColor?: string;
    textColor?: string;
    sticky?: boolean;
  }>(),
  {
    brand: "Luban",
    links: () => [],
    backgroundColor: "var(--lb-bg)",
    textColor: "var(--lb-bg-dark)",
    sticky: true,
  }
);
</script>

<template>
  <header
    class="lb-navbar"
    :class="{ 'lb-navbar--sticky': sticky }"
    :style="{ backgroundColor, color: textColor }"
  >
    <div class="lb-navbar__inner">
      <a class="lb-navbar__brand" href="#">{{ brand }}</a>
      <nav class="lb-navbar__nav" v-if="links.length">
        <a v-for="(link, i) in links" :key="i" class="lb-navbar__link" :href="link.url">{{ link.label }}</a>
      </nav>
    </div>
  </header>
</template>

<style scoped lang="scss">
.lb-navbar {
  width: 100%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--lb-border);
  &--sticky {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  }
}
.lb-navbar__inner {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 64px;
}
.lb-navbar__brand {
  font-size: 1.375rem; font-weight: 800; color: var(--lb-primary); text-decoration: none; letter-spacing: -0.5px;
}
.lb-navbar__nav { display: flex; gap: 28px; align-items: center; }
.lb-navbar__link {
  font-size: 0.875rem; font-weight: 500; color: var(--lb-text-secondary); text-decoration: none; transition: color 0.15s;
  &:hover { color: var(--lb-text-primary); }
}
</style>
