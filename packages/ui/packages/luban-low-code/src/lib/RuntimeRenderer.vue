<script setup lang="ts">
import { getComponent } from './registry';
import type { NodeSchema } from './schema';
import { validate, type ValidationRule } from './validation';

const FORM_VALUE_TYPES = new Set([
  'LubanInput',
  'LubanTextArea',
  'LubanSelect',
  'LubanCheckbox',
  'LubanRadioGroup',
  'LubanSwitch',
]);

const props = withDefaults(
  defineProps<{
    root: NodeSchema;
    formState: Record<string, unknown>;
    formErrors?: Record<string, string>;
  }>(),
  { formErrors: () => ({}) }
);

function getFormValue(name: string | undefined): unknown {
  if (name == null) return undefined;
  return props.formState[name];
}

function setFormValue(name: string | undefined, value: unknown): void {
  if (name == null) return;
  const state = props.formState as Record<string, unknown>;
  if (name in state) {
    state[name] = value;
    const rules = (props.root.props?.rules as ValidationRule[] | undefined);
    const message = validate(value, rules);
    if (message) {
      (props.formErrors as Record<string, string>)[name] = message;
    } else {
      delete (props.formErrors as Record<string, string>)[name];
    }
  }
}

function isFormValueType(type: string): boolean {
  return FORM_VALUE_TYPES.has(type);
}

function getFieldError(name: string | undefined): string | undefined {
  if (name == null) return undefined;
  return props.formErrors[name];
}

/** Re-run validation for a field (e.g. on blur) without changing value */
function validateField(name: string | undefined): void {
  if (name == null) return;
  const value = getFormValue(name);
  const rules = (props.root.props?.rules as ValidationRule[] | undefined);
  const message = validate(value, rules);
  const err = props.formErrors as Record<string, string>;
  if (message) err[name] = message;
  else delete err[name];
}

/** Props for form value component: base props + modelValue + error/errorMessage from validation */
function formValueProps(nodeProps: Record<string, unknown> | undefined, name: string | undefined): Record<string, unknown> {
  if (nodeProps == null) return {};
  const { content: _c, text: _t, rules: _r, ...rest } = nodeProps;
  const errorMessage = getFieldError(name);
  return {
    ...rest,
    error: !!errorMessage,
    errorMessage: errorMessage ?? undefined,
  };
}

/** Props for component, excluding content/text (used for slot instead) */
function componentProps(nodeProps: Record<string, unknown> | undefined): Record<string, unknown> {
  if (nodeProps == null) return {};
  const { content: _c, text: _t, rules: _r, ...rest } = nodeProps;
  return rest;
}

function slotContent(): string {
  const p = props.root.props;
  if (p?.content != null) return String(p.content);
  if (p?.text != null) return String(p.text);
  return '';
}
</script>

<template>
  <template v-if="root">
    <!-- Form value components: bind v-model to formState + validation error -->
    <component
      v-if="getComponent(root.type) && isFormValueType(root.type)"
      :is="getComponent(root.type)"
      v-bind="formValueProps(root.props as Record<string, unknown>, root.props?.name as string)"
      :model-value="
        root.props?.name != null
          ? getFormValue(root.props.name as string)
          : undefined
      "
      @update:model-value="
        root.props?.name != null
          ? setFormValue(root.props.name as string, $event)
          : () => {}
      "
      @blur="validateField(root.props?.name as string)"
    >
      <RuntimeRenderer
        v-for="child in (root.children ?? [])"
        :key="child.id"
        :root="child"
        :form-state="formState"
        :form-errors="formErrors"
      />
    </component>
    <!-- Non-form components: props only, optional slot from content/text -->
    <component
      v-else-if="getComponent(root.type)"
      :is="getComponent(root.type)"
      v-bind="componentProps(root.props as Record<string, unknown>)"
    >
      <template v-if="(root.children ?? []).length">
        <RuntimeRenderer
          v-for="child in (root.children ?? [])"
          :key="child.id"
          :root="child"
          :form-state="formState"
          :form-errors="formErrors"
        />
      </template>
      <template v-else-if="slotContent()">{{ slotContent() }}</template>
    </component>
    <template v-else>
      <RuntimeRenderer
        v-for="child in (root.children ?? [])"
        :key="child.id"
        :root="child"
        :form-state="formState"
        :form-errors="formErrors"
      />
    </template>
  </template>
</template>
