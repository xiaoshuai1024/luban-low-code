<script setup lang="ts">
type ObjectFit = 'cover' | 'contain' | 'fill' | 'none';

withDefaults(
  defineProps<{
    /** Image URL */
    src: string;
    /** Alt text for accessibility */
    alt?: string;
    /** Optional link URL; when set, banner is wrapped in <a> */
    href?: string;
    /** Height in px or 'auto' for natural height */
    height?: number | string;
    /** Object-fit for the image */
    objectFit?: ObjectFit;
  }>(),
  { alt: '', objectFit: 'cover' }
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    class="lb-banner"
    :class="{ 'lb-banner--link': !!href }"
    :href="href"
    :style="{
      height: height === 'auto' || height == null ? undefined : typeof height === 'number' ? `${height}px` : height,
    }"
    @click="!href && $emit('click', $event)"
  >
    <img
      class="lb-banner__img"
      :src="src"
      :alt="alt"
      :style="{ objectFit }"
    />
  </component>
</template>

<style scoped lang="scss">
@use '../../styles/content.scss';
</style>
