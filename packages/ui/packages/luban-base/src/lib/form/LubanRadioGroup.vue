<script setup lang="ts">
import type { LubanRadioOption } from './form-types';

withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    label?: string;
    name?: string;
    options?: LubanRadioOption[];
    required?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: null,
    options: () => [],
    required: false,
    disabled: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null];
}>();
</script>

<template>
  <div class="lb-form-field">
    <div v-if="label" class="lb-form-field__label" :class="{ 'lb-form-field__label--required': required }">
      {{ label }}
    </div>
    <div class="lb-radio-group">
      <div class="lb-radio-group__options">
        <label
          v-for="opt in options"
          :key="String(opt.value)"
          class="lb-radio-group__option"
        >
          <input
            type="radio"
            :name="name"
            :value="opt.value"
            :checked="modelValue === opt.value"
            :required="required"
            :disabled="disabled"
            @change="emit('update:modelValue', opt.value)"
          />
          {{ opt.label }}
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/form.scss';
</style>
