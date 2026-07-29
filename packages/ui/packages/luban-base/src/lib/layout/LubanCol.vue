<script setup lang="ts">
withDefaults(
  defineProps<{
    grow?: number;
    basis?: number | string;
    alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  }>(),
  { grow: 0, basis: 'auto', alignSelf: 'auto' }
);
</script>

<template>
  <div
    class="lb-col"
    :style="{
      flexGrow: grow,
      flexBasis: typeof basis === 'number' ? `${basis}%` : basis,
      alignSelf: alignSelf !== 'auto' ? alignSelf : undefined,
    }"
  >
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/layout.scss';
</style>
