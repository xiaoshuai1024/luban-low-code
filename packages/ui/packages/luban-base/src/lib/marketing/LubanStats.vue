<script setup lang="ts">
withDefaults(
  defineProps<{
    stats?: Array<{ value: string; label: string; suffix?: string }>;
    backgroundColor?: string;
    textColor?: string;
  }>(),
  {
    stats: () => [],
    backgroundColor: "var(--lb-bg-muted)",
    textColor: "var(--lb-text-heading)",
  }
);
</script>

<template>
  <section
    class="lb-stats"
    :style="{ backgroundColor, color: textColor }"
  >
    <div class="lb-stats__inner">
      <div v-if="stats.length" class="lb-stats__list">
        <div
          v-for="(item, i) in stats"
          :key="i"
          class="lb-stats__item"
        >
          <div class="lb-stats__value">
            {{ item.value }}<span v-if="item.suffix" class="lb-stats__suffix">{{ item.suffix }}</span>
          </div>
          <div class="lb-stats__label">{{ item.label }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-stats {
  width: 100%;
  padding: 56px 24px;
}
.lb-stats__inner {
  max-width: 1200px;
  margin: 0 auto;
}
.lb-stats__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 32px;
  text-align: center;
}
.lb-stats__value {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.1;
}
.lb-stats__suffix {
  font-size: 1.25rem;
  margin-left: 2px;
}
.lb-stats__label {
  font-size: 0.95rem;
  opacity: 0.7;
  margin-top: 8px;
}
</style>
