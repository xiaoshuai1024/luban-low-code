<script setup lang="ts">
withDefaults(
  defineProps<{
    heading?: string;
    items?: Array<{ question: string; answer: string }>;
    defaultOpenIndex?: number;
    backgroundColor?: string;
  }>(),
  {
    heading: "常见问题",
    items: () => [],
    defaultOpenIndex: -1,
    backgroundColor: "var(--lb-bg)",
  }
);
</script>

<template>
  <section
    class="lb-faq"
    :style="{ backgroundColor }"
  >
    <div class="lb-faq__inner">
      <h2 v-if="heading" class="lb-faq__heading">{{ heading }}</h2>
      <div v-if="items.length" class="lb-faq__list">
        <details
          v-for="(item, i) in items"
          :key="i"
          class="lb-faq__item"
          :open="i === defaultOpenIndex"
        >
          <summary class="lb-faq__question">{{ item.question }}</summary>
          <div class="lb-faq__answer">{{ item.answer }}</div>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-faq {
  width: 100%;
  padding: 64px 24px;
}
.lb-faq__inner {
  max-width: 800px;
  margin: 0 auto;
}
.lb-faq__heading {
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  margin: 0 0 32px;
}
.lb-faq__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lb-faq__item {
  border: 1px solid var(--lb-border);
  border-radius: 8px;
  padding: 0 20px;
  background: var(--lb-bg);
}
.lb-faq__question {
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  padding: 16px 0;
  list-style: none;
}
.lb-faq__answer {
  font-size: 0.9rem;
  color: var(--lb-text-body);
  line-height: 1.6;
  padding: 0 0 16px;
}
</style>
