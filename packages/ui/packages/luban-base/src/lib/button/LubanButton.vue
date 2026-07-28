<script setup lang="ts">
import type { ButtonVariant, ButtonColor } from './button-types';

withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    color?: ButtonColor;
    disabled?: boolean;
    block?: boolean;
    type?: 'button' | 'submit' | 'reset';
    content?: string;
  }>(),
  {
    variant: 'contained',
    color: 'primary',
    disabled: false,
    block: false,
    type: 'button',
    content: '',
  }
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    :type="type"
    class="lb-button"
    :class="[
      `lb-button--${variant}`,
      `lb-button--${color}`,
      { 'lb-button--block': block },
    ]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot>{{ content }}</slot>
  </button>
</template>

<style scoped lang="scss">
@use '../../styles/button.scss';
</style>
