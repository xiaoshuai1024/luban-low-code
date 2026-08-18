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
          :class="`lb-feature-grid__card--${i % 5}`"
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
/* 标题：渐变下划线装饰 */
.lb-feature-grid__heading {
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  margin: 0 0 12px;
}
.lb-feature-grid__heading::after {
  content: "";
  display: block;
  width: 56px; height: 4px;
  margin: 14px auto 0;
  border-radius: 999px;
  background: linear-gradient(90deg, #4f46e5, #06b6d4, #7c3aed);
}
.lb-feature-grid__list {
  display: grid;
  gap: 24px;
  margin-top: 28px;
}
.lb-feature-grid__card {
  position: relative;
  padding: 32px;
  border: 1px solid var(--lb-border);
  border-radius: 14px;
  background: var(--lb-bg);
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 32px -12px rgba(79,70,229,.22);
  }
}
/* 图标芯片：五色渐变循环（0..4） indigo/cyan/violet/rose/amber */
.lb-feature-grid__icon {
  display: flex; align-items: center; justify-content: center;
  width: 52px; height: 52px;
  font-size: 1.5rem;
  border-radius: 14px;
  color: #fff;
  margin-bottom: 16px;
  transition: transform .22s ease;
}
.lb-feature-grid__card:hover .lb-feature-grid__icon { transform: scale(1.1) rotate(-6deg); }
.lb-feature-grid__card--0 .lb-feature-grid__icon { background: linear-gradient(135deg, #4f46e5, #818cf8); box-shadow: 0 6px 14px -4px rgba(79,70,229,.45); }
.lb-feature-grid__card--1 .lb-feature-grid__icon { background: linear-gradient(135deg, #0891b2, #22d3ee); box-shadow: 0 6px 14px -4px rgba(8,145,178,.45); }
.lb-feature-grid__card--2 .lb-feature-grid__icon { background: linear-gradient(135deg, #7c3aed, #a78bfa); box-shadow: 0 6px 14px -4px rgba(124,58,237,.45); }
.lb-feature-grid__card--3 .lb-feature-grid__icon { background: linear-gradient(135deg, #e11d48, #fb7185); box-shadow: 0 6px 14px -4px rgba(225,29,72,.4); }
.lb-feature-grid__card--4 .lb-feature-grid__icon { background: linear-gradient(135deg, #d97706, #fbbf24); box-shadow: 0 6px 14px -4px rgba(217,119,6,.4); }
/* 卡片 hover 顶部渐变光条（对应图标配色） */
.lb-feature-grid__card::before {
  content: "";
  position: absolute; top: 0; left: 24px; right: 24px; height: 3px;
  border-radius: 0 0 999px 999px;
  opacity: 0; transition: opacity .22s ease;
}
.lb-feature-grid__card:hover::before { opacity: 1; }
.lb-feature-grid__card--0:hover { border-color: #c7d2fe; } .lb-feature-grid__card--0::before { background: linear-gradient(90deg,#4f46e5,#818cf8); }
.lb-feature-grid__card--1:hover { border-color: #a5f3fc; } .lb-feature-grid__card--1::before { background: linear-gradient(90deg,#0891b2,#22d3ee); }
.lb-feature-grid__card--2:hover { border-color: #ddd6fe; } .lb-feature-grid__card--2::before { background: linear-gradient(90deg,#7c3aed,#a78bfa); }
.lb-feature-grid__card--3:hover { border-color: #fecdd3; } .lb-feature-grid__card--3::before { background: linear-gradient(90deg,#e11d48,#fb7185); }
.lb-feature-grid__card--4:hover { border-color: #fde68a; } .lb-feature-grid__card--4::before { background: linear-gradient(90deg,#d97706,#fbbf24); }
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
@media (prefers-reduced-motion: reduce) {
  .lb-feature-grid__card, .lb-feature-grid__icon { transition: none; }
}
</style>
