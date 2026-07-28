<script setup lang="ts">
type FormSize = 'small' | 'medium' | 'large';

const props = withDefaults(
  defineProps<{
    /** Form width size; controls max-width, default medium (~800px) */
    size?: FormSize;
  }>(),
  { size: 'medium' }
);

defineEmits<{
  submit: [event: Event];
}>();
</script>

<template>
  <form
    class="lb-form"
    :class="[`lb-form--size-${props.size}`]"
    @submit.prevent="(e) => $emit('submit', e)"
  >
    <slot />
  </form>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as v;

.lb-form {
  display: flex;
  flex-direction: column;
  gap: v.$lb-spacing-unit * 2;
  width: 100%;
  box-sizing: border-box;
  margin-inline: auto;

  &.lb-form--size-small {
    max-width: 600px;
  }

  &.lb-form--size-medium {
    max-width: 800px;
  }

  &.lb-form--size-large {
    max-width: 960px;
  }
}
</style>
