<script setup lang="ts">
withDefaults(
  defineProps<{
    heading?: string;
    logos?: Array<{ src: string; alt?: string; url?: string }>;
    grayscale?: boolean;
    backgroundColor?: string;
  }>(),
  {
    heading: "他们都在使用",
    logos: () => [],
    grayscale: true,
    backgroundColor: "var(--lb-bg-muted)",
  }
);
</script>

<template>
  <section
    class="lb-logo-cloud"
    :style="{ backgroundColor }"
  >
    <div class="lb-logo-cloud__inner">
      <h2 v-if="heading" class="lb-logo-cloud__heading">{{ heading }}</h2>
      <div v-if="logos.length" class="lb-logo-cloud__list">
        <a
          v-for="(logo, i) in logos"
          :key="i"
          class="lb-logo-cloud__item"
          :href="logo.url ? logo.url : '#'"
        >
          <img
            class="lb-logo-cloud__img"
            :class="{ 'lb-logo-cloud__img--gray': grayscale }"
            :src="logo.src"
            :alt="logo.alt"
          />
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-logo-cloud {
  width: 100%;
  padding: 48px 24px;
}
.lb-logo-cloud__inner {
  max-width: 1200px;
  margin: 0 auto;
}
.lb-logo-cloud__heading {
  font-size: 1.125rem;
  font-weight: 600;
  text-align: center;
  opacity: 0.6;
  margin: 0 0 24px;
}
.lb-logo-cloud__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 40px;
}
.lb-logo-cloud__img {
  height: 40px;
  width: auto;
  object-fit: contain;
  transition: filter 0.2s;
  &--gray {
    filter: grayscale(100%);
    opacity: 0.7;
  }
}
.lb-logo-cloud__item {
  display: inline-flex;
}
</style>
