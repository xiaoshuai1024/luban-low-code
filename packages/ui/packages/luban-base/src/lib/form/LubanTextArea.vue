<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    name?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    rows?: number;
    helperText?: string;
    error?: boolean;
    errorMessage?: string;
  }>(),
  {
    modelValue: '',
    required: false,
    disabled: false,
    rows: 3,
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
    <textarea
      :value="modelValue"
      :name="name"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :aria-invalid="error"
      class="lb-textarea"
      :class="{ 'lb-textarea--error': error }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
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
