<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    testimonials?: Array<{
      quote: string;
      author: string;
      role?: string;
      avatarUrl?: string;
      rating?: number;
    }>;
    interval?: number;
    autoplay?: boolean;
    backgroundColor?: string;
  }>(),
  {
    testimonials: () => [],
    interval: 5000,
    autoplay: true,
    backgroundColor: "var(--lb-bg)",
  }
);

const current = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function go(next: number) {
  const len = props.testimonials.length;
  if (len === 0) return;
  current.value = (next + len) % len;
}

onMounted(() => {
  if (props.autoplay) {
    timer = setInterval(() => go(current.value + 1), props.interval);
  }
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <section
    class="lb-testimonial-carousel"
    :style="{ backgroundColor }"
  >
    <div class="lb-testimonial-carousel__inner">
      <div v-if="testimonials.length" class="lb-testimonial-carousel__slide">
        <div class="lb-testimonial-carousel__rating" v-if="testimonials[current].rating">
          <span
            v-for="n in 5"
            :key="n"
            class="lb-testimonial-carousel__star"
            :class="{ 'lb-testimonial-carousel__star--on': (testimonials[current]?.rating ?? 0) >= n }"
          >★</span>
        </div>
        <blockquote class="lb-testimonial-carousel__quote">{{ testimonials[current].quote }}</blockquote>
        <div class="lb-testimonial-carousel__author">
          <img
            v-if="testimonials[current].avatarUrl"
            class="lb-testimonial-carousel__avatar"
            :src="testimonials[current].avatarUrl"
            :alt="testimonials[current].author"
          />
          <div>
            <div class="lb-testimonial-carousel__name">{{ testimonials[current].author }}</div>
            <div v-if="testimonials[current].role" class="lb-testimonial-carousel__role">{{ testimonials[current].role }}</div>
          </div>
        </div>
        <div class="lb-testimonial-carousel__dots">
          <button
            v-for="(_t, i) in testimonials"
            :key="i"
            class="lb-testimonial-carousel__dot"
            :class="{ 'lb-testimonial-carousel__dot--on': i === current }"
            @click="current = i"
          ></button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-testimonial-carousel {
  width: 100%;
  padding: 64px 24px;
}
.lb-testimonial-carousel__inner {
  max-width: 800px;
  margin: 0 auto;
}
.lb-testimonial-carousel__slide {
  text-align: center;
}
.lb-testimonial-carousel__rating {
  margin-bottom: 16px;
}
.lb-testimonial-carousel__star {
  color: var(--lb-border-strong);
  font-size: 1.25rem;
  margin: 0 2px;
  &--on {
    color: var(--lb-star-active);
  }
}
.lb-testimonial-carousel__quote {
  font-size: 1.25rem;
  line-height: 1.6;
  margin: 0 0 24px;
  font-style: italic;
}
.lb-testimonial-carousel__author {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.lb-testimonial-carousel__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
.lb-testimonial-carousel__name {
  font-weight: 600;
}
.lb-testimonial-carousel__role {
  font-size: 0.85rem;
  opacity: 0.7;
}
.lb-testimonial-carousel__dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}
.lb-testimonial-carousel__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--lb-border-strong);
  cursor: pointer;
  padding: 0;
  &--on {
    background: var(--lb-bg-dark);
  }
}
</style>
