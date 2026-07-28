<script setup lang="ts">
withDefaults(
  defineProps<{
    align?: 'start' | 'center' | 'end';
    justify?: 'start' | 'center' | 'end' | 'between';
    direction?: 'row' | 'column';
    gap?: number;
    wrap?: boolean;
  }>(),
  {
    align: 'start',
    justify: 'start',
    direction: 'row',
    gap: 0,
    wrap: true,
  }
);
</script>

<template>
  <div
    class="lb-row"
    :class="[
      `lb-row--direction-${direction}`,
      `lb-row--align-${align}`,
      `lb-row--justify-${justify}`,
      wrap ? 'lb-row--wrap' : 'lb-row--nowrap',
    ]"
    :style="{ gap: gap ? `${gap}px` : undefined }"
  >
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/layout.scss';
</style>
