<script setup lang="ts">
withDefaults(
  defineProps<{
    columns?: Array<{
      title: string;
      links: Array<{ label: string; url: string }>;
    }>;
    copyright?: string;
    backgroundColor?: string;
    textColor?: string;
  }>(),
  {
    columns: () => [],
    copyright: "© 2026",
    backgroundColor: "var(--lb-bg-dark)",
    textColor: "var(--lb-text-on-dark)",
  }
);
</script>

<template>
  <footer
    class="lb-footer"
    :style="{ backgroundColor, color: textColor }"
  >
    <div class="lb-footer__inner">
      <div class="lb-footer__columns" v-if="columns.length">
        <div
          v-for="(col, i) in columns"
          :key="i"
          class="lb-footer__column"
        >
          <h4 class="lb-footer__title">{{ col.title }}</h4>
          <ul class="lb-footer__list" v-if="col.links?.length">
            <li v-for="(link, j) in col.links" :key="j">
              <a class="lb-footer__link" :href="link.url">{{ link.label }}</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="lb-footer__bottom">
        <span class="lb-footer__copyright">{{ copyright }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.lb-footer { width: 100%; padding: 64px 24px 32px; }
.lb-footer__inner { max-width: 1200px; margin: 0 auto; }
.lb-footer__columns { display: grid; grid-template-columns: 2fr repeat(auto-fit, minmax(140px, 1fr)); gap: 48px; padding-bottom: 32px; }
.lb-footer__title { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px; opacity: .5; }
.lb-footer__list { list-style: none; padding: 0; margin: 0; }
.lb-footer__link { display: block; padding: 4px 0; font-size: .9rem; opacity: .7; text-decoration: none; color: inherit; transition: opacity .15s; &:hover { opacity: 1; } }
.lb-footer__bottom { border-top: 1px solid rgba(255,255,255,.08); padding-top: 24px; margin-top: 48px; text-align: center; display: flex; justify-content: space-between; }
.lb-footer__copyright { font-size: .8rem; opacity: .4; }
</style>
