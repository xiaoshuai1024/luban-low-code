<script setup lang="ts">
type TextTag = 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
type TextVariant = 'body1' | 'body2' | 'caption' | 'h1' | 'h2' | 'h3';

withDefaults(
  defineProps<{
    /** Semantic HTML tag */
    tag?: TextTag;
    /** Typography variant (maps to class lb-text--*) */
    variant?: TextVariant;
    /** Secondary color when true */
    secondary?: boolean;
    /** Inline text when no slot content (designer/schema can set content or text) */
    content?: string;
  }>(),
  { tag: 'p', variant: 'body1', secondary: false, content: '' }
);
</script>

<template>
  <component
    :is="tag"
    class="lb-text"
    :class="[
      `lb-text--${variant}`,
      { 'lb-text--secondary': secondary },
    ]"
  >
    <slot>{{ content }}</slot>
  </component>
</template>

<style scoped lang="scss">
@use '../../styles/content.scss';
</style>
