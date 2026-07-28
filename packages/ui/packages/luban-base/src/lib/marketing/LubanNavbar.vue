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
        <a
          v-for="(link, i) in links"
          :key="i"
          class="lb-navbar__link"
          :href="link.url"
          >{{ link.label }}</a
        >
      </nav>
    </div>
  </header>
</template>

<style scoped lang="scss">
.lb-navbar {
  width: 100%;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  &--sticky {
    position: sticky;
    top: 0;
    z-index: 100;
  }
}
.lb-navbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
}
.lb-navbar__brand {
  font-size: 1.25rem;
  font-weight: 700;
  text-decoration: none;
  color: inherit;
}
.lb-navbar__nav {
  display: flex;
  gap: 24px;
}
.lb-navbar__link {
  font-size: 0.95rem;
  text-decoration: none;
  color: inherit;
  opacity: 0.85;
  transition: opacity 0.2s;
  &:hover {
    opacity: 1;
  }
}
</style>
