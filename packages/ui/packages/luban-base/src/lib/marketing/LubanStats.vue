<script setup lang="ts">
withDefaults(
  defineProps<{
    stats?: Array<{ value: string; label: string; suffix?: string; icon?: string }>;
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
          :class="`lb-stats__item--${i % 4}`"
        >
          <div v-if="item.icon" class="lb-stats__icon">{{ item.icon }}</div>
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
  gap: 24px;
  text-align: center;
}
.lb-stats__item {
  padding: 24px 16px;
  border-radius: 16px;
  border: 1px solid transparent;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  /* 四色循环渐变（0..3）：indigo / cyan / violet / amber */
  &:hover { transform: translateY(-4px); border-color: var(--lb-border); box-shadow: 0 12px 24px -8px rgba(79,70,229,.18); }
}
/* 数值渐变配色按索引循环 */
.lb-stats__item--0 .lb-stats__value { background: linear-gradient(135deg, #4f46e5, #818cf8); }
.lb-stats__item--1 .lb-stats__value { background: linear-gradient(135deg, #0891b2, #22d3ee); }
.lb-stats__item--2 .lb-stats__value { background: linear-gradient(135deg, #7c3aed, #a78bfa); }
.lb-stats__item--3 .lb-stats__value { background: linear-gradient(135deg, #d97706, #fbbf24); }
.lb-stats__value {
  display: inline-block;
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.1;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.lb-stats__icon {
  font-size: 1.5rem;
  width: 52px; height: 52px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 14px; margin-bottom: 12px;
  background: rgba(79,70,229,.08);
  transition: transform .2s ease;
}
.lb-stats__item:hover .lb-stats__icon { transform: scale(1.12) rotate(-6deg); }
.lb-stats__suffix {
  font-size: 1.25rem;
  margin-left: 2px;
}
.lb-stats__label {
  font-size: 0.95rem;
  opacity: 0.7;
  margin-top: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .lb-stats__item, .lb-stats__icon { transition: none; }
}
</style>
