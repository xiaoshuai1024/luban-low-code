<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
    name?: string;
    required?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: false,
    required: false,
    disabled: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <div class="lb-form-field">
    <label class="lb-checkbox">
      <input
        type="checkbox"
        :checked="modelValue"
        :name="name"
        :required="required"
        :disabled="disabled"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span v-if="label" class="lb-form-field__label" :class="{ 'lb-form-field__label--required': required }">
        {{ label }}
      </span>
    </label>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/form.scss';
</style>
