<script setup lang="ts">
withDefaults(
  defineProps<{
    heading?: string;
    plans?: Array<{
      name: string;
      price: string;
      period?: string;
      features?: Array<{ text: string; included: boolean }>;
      ctaText?: string;
      ctaUrl?: string;
    }>;
    highlightIndex?: number;
    backgroundColor?: string;
  }>(),
  {
    heading: "选择方案",
    plans: () => [],
    highlightIndex: -1,
    backgroundColor: "var(--lb-bg-muted)",
  }
);
</script>

<template>
  <section
    class="lb-pricing"
    :style="{ backgroundColor }"
  >
    <div class="lb-pricing__inner">
      <h2 v-if="heading" class="lb-pricing__heading">{{ heading }}</h2>
      <div v-if="plans.length" class="lb-pricing__list">
        <div
          v-for="(plan, i) in plans"
          :key="i"
          class="lb-pricing__plan"
          :class="{ 'lb-pricing__plan--highlight': i === highlightIndex }"
        >
          <h3 class="lb-pricing__name">{{ plan.name }}</h3>
          <div class="lb-pricing__price">
            {{ plan.price }}<span v-if="plan.period" class="lb-pricing__period">/{{ plan.period }}</span>
          </div>
          <ul v-if="plan.features?.length" class="lb-pricing__features">
            <li
              v-for="(f, j) in plan.features"
              :key="j"
              class="lb-pricing__feature"
              :class="{ 'lb-pricing__feature--off': !f.included }"
            >{{ f.text }}</li>
          </ul>
          <a
            v-if="plan.ctaText"
            class="lb-pricing__cta"
            :href="plan.ctaUrl ? plan.ctaUrl : '#'"
          >{{ plan.ctaText }}</a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-pricing {
  width: 100%;
  padding: 64px 24px;
}
.lb-pricing__inner {
  max-width: 1200px;
  margin: 0 auto;
}
.lb-pricing__heading {
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  margin: 0 0 40px;
}
.lb-pricing__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  align-items: start;
}
.lb-pricing__plan {
  padding: 32px 28px;
  border: 1px solid var(--lb-border);
  border-radius: 16px;
  background: var(--lb-bg);
  &--highlight {
    border-color: var(--lb-bg-dark);
    box-shadow: 0 8px 24px rgba(26, 26, 46, 0.12);
  }
}
.lb-pricing__name {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}
.lb-pricing__price {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 20px;
}
.lb-pricing__period {
  font-size: 0.95rem;
  font-weight: 400;
  opacity: 0.6;
}
.lb-pricing__features {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
}
.lb-pricing__feature {
  font-size: 0.9rem;
  padding: 6px 0;
  &--off {
    opacity: 0.4;
    text-decoration: line-through;
  }
}
.lb-pricing__cta {
  display: block;
  text-align: center;
  padding: 12px;
  background: var(--lb-bg-dark);
  color: var(--lb-text-on-dark);
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
}
</style>
