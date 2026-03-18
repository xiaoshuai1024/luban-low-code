<script setup lang="ts">
type MaxWidth = 'sm' | 'md' | 'lg' | 'full';

withDefaults(
  defineProps<{
    maxWidth?: MaxWidth;
    padded?: boolean;
  }>(),
  { maxWidth: 'full', padded: false }
);
</script>

<template>
  <div
    class="lb-container"
    :class="[
      `lb-container--max-width-${maxWidth}`,
      { 'lb-container--padded': padded },
    ]"
  >
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/layout.scss';
</style>
