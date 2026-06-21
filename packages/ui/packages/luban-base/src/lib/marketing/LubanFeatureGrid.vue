<script setup lang="ts">
withDefaults(
  defineProps<{
    heading?: string;
    columns?: number;
    features?: Array<{ icon?: string; title: string; description?: string }>;
    backgroundColor?: string;
  }>(),
  {
    heading: "核心特性",
    columns: 3,
    features: () => [],
    backgroundColor: "var(--lb-bg)",
  }
);
</script>

<template>
  <section
    class="lb-feature-grid"
    :style="{ backgroundColor }"
  >
    <div class="lb-feature-grid__inner">
      <h2 v-if="heading" class="lb-feature-grid__heading">{{ heading }}</h2>
      <div
        v-if="features.length"
        class="lb-feature-grid__list"
        :style="{ gridTemplateColumns: 'repeat(' + columns + ', 1fr)' }"
      >
        <div
          v-for="(item, i) in features"
          :key="i"
          class="lb-feature-grid__card"
        >
          <div v-if="item.icon" class="lb-feature-grid__icon">{{ item.icon }}</div>
          <h3 class="lb-feature-grid__title">{{ item.title }}</h3>
          <p v-if="item.description" class="lb-feature-grid__desc">{{ item.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-feature-grid {
  width: 100%;
  padding: 64px 24px;
}
.lb-feature-grid__inner {
  max-width: 1200px;
  margin: 0 auto;
}
.lb-feature-grid__heading {
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  margin: 0 0 40px;
}
.lb-feature-grid__list {
  display: grid;
  gap: 24px;
}
.lb-feature-grid__card {
  padding: 28px 24px;
  border: 1px solid var(--lb-border);
  border-radius: 12px;
  background: var(--lb-bg);
}
.lb-feature-grid__icon {
  font-size: 2rem;
  margin-bottom: 12px;
}
.lb-feature-grid__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 8px;
}
.lb-feature-grid__desc {
  font-size: 0.9rem;
  color: var(--lb-text-muted);
  line-height: 1.6;
  margin: 0;
}
</style>
