<script setup lang="ts">
withDefaults(
  defineProps<{
    images?: Array<{ src: string; alt?: string; caption?: string }>;
    columns?: number;
    gap?: string;
    backgroundColor?: string;
  }>(),
  {
    images: () => [],
    columns: 3,
    gap: "16px",
    backgroundColor: "var(--lb-bg)",
  }
);
</script>

<template>
  <section
    class="lb-gallery"
    :style="{ backgroundColor }"
  >
    <div class="lb-gallery__inner">
      <div
        v-if="images.length"
        class="lb-gallery__grid"
        :style="{ gridTemplateColumns: 'repeat(' + columns + ', 1fr)', gap }"
      >
        <figure
          v-for="(img, i) in images"
          :key="i"
          class="lb-gallery__item"
        >
          <img
            class="lb-gallery__img"
            :src="img.src"
            :alt="img.alt"
          />
          <figcaption v-if="img.caption" class="lb-gallery__caption">{{ img.caption }}</figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-gallery {
  width: 100%;
  padding: 64px 24px;
}
.lb-gallery__inner {
  max-width: 1200px;
  margin: 0 auto;
}
.lb-gallery__grid {
  display: grid;
}
.lb-gallery__item {
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--lb-bg-muted);
}
.lb-gallery__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lb-gallery__caption {
  padding: 8px 12px;
  font-size: 0.85rem;
  color: var(--lb-text-body);
  text-align: center;
}
</style>
