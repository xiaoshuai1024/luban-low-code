<script setup lang="ts">
import type { LubanSelectOption } from './form-types';

withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    label?: string;
    name?: string;
    placeholder?: string;
    options?: LubanSelectOption[];
    required?: boolean;
    disabled?: boolean;
    helperText?: string;
    error?: boolean;
    errorMessage?: string;
  }>(),
  {
    modelValue: null,
    options: () => [],
    required: false,
    disabled: false,
    error: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();
</script>

<template>
  <div class="lb-form-field">
    <label v-if="label" class="lb-form-field__label" :class="{ 'lb-form-field__label--required': required }">
      {{ label }}
    </label>
    <select
      :value="modelValue"
      :name="name"
      :disabled="disabled"
      :aria-invalid="error"
      class="lb-select__native"
      :class="{ 'lb-select--error': error }"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value === '' ? null : (Number(($event.target as HTMLSelectElement).value) || ($event.target as HTMLSelectElement).value))"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="opt in options"
        :key="String(opt.value)"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </select>
    <p v-if="helperText && !error" class="lb-form-field__helper">{{ helperText }}</p>
    <p v-if="error && errorMessage" class="lb-form-field__error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/form.scss';
</style>
