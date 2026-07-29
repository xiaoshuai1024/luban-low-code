<script setup lang="ts">
import type { LubanInputType } from './form-types';

withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    name?: string;
    type?: LubanInputType;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    helperText?: string;
    error?: boolean;
    errorMessage?: string;
  }>(),
  {
    modelValue: '',
    type: 'text',
    required: false,
    disabled: false,
    error: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();
</script>

<template>
  <div class="lb-form-field">
    <label v-if="label" class="lb-form-field__label" :class="{ 'lb-form-field__label--required': required }">
      {{ label }}
    </label>
    <input
      :value="modelValue"
      :type="type"
      :name="name"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="error"
      class="lb-input"
      :class="{ 'lb-input--error': error }"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
    />
    <p v-if="helperText && !error" class="lb-form-field__helper">{{ helperText }}</p>
    <p v-if="error && errorMessage" class="lb-form-field__error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/form.scss';
</style>
