<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
    name?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: false,
    disabled: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <div class="lb-form-field">
    <div class="lb-switch">
      <button
        type="button"
        role="switch"
        :aria-checked="modelValue"
        :aria-disabled="disabled"
        class="lb-switch__track"
        :class="{
          'lb-switch__track--checked': modelValue,
          'lb-switch__track--disabled': disabled,
        }"
        :disabled="disabled"
        @click="emit('update:modelValue', !modelValue)"
      >
        <span class="lb-switch__thumb" />
      </button>
      <span v-if="label" class="lb-form-field__label">{{ label }}</span>
    </div>
    <input v-if="name" type="hidden" :name="name" :value="modelValue ? 'on' : ''" />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/form.scss';
</style>
