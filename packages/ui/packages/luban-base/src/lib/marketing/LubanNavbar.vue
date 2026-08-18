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
      <a class="lb-navbar__brand" href="#">
        <span class="lb-navbar__logo" aria-hidden="true">L</span>{{ brand }}
      </a>
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
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 1.375rem; font-weight: 800;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  text-decoration: none; letter-spacing: -0.5px;
}
/* 品牌 logo 方块：渐变 + 呼吸光晕；文字用渐变裁切故 logo 用 span 独立着色 */
.lb-navbar__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  font-size: 1rem; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  box-shadow: 0 4px 10px -2px rgba(79,70,229,.5);
  -webkit-text-fill-color: #fff;
  animation: lb-navbar-glow 3s ease-in-out infinite;
}
@keyframes lb-navbar-glow {
  0%, 100% { box-shadow: 0 4px 10px -2px rgba(79,70,229,.45); }
  50%      { box-shadow: 0 4px 18px -2px rgba(124,58,237,.75); }
}
.lb-navbar__nav { display: flex; gap: 28px; align-items: center; }
/* 链接：hover 渐变下划线从左滑入 */
.lb-navbar__link {
  position: relative;
  font-size: 0.875rem; font-weight: 500; color: var(--lb-text-secondary);
  text-decoration: none; padding: 4px 0; transition: color 0.18s ease;
  &::after {
    content: "";
    position: absolute; left: 0; right: 0; bottom: -2px;
    height: 2px; border-radius: 999px;
    background: linear-gradient(90deg, #4f46e5, #06b6d4);
    transform: scaleX(0); transform-origin: left center;
    transition: transform 0.22s ease;
  }
  &:hover { color: var(--lb-text-primary); &::after { transform: scaleX(1); } }
}
@media (prefers-reduced-motion: reduce) {
  .lb-navbar__logo { animation: none; }
  .lb-navbar__link::after { transition: none; }
}
</style>
