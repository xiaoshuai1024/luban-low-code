<script setup lang="ts">
import { getComponent } from './registry';
import type { NodeSchema } from './schema';

const FORM_VALUE_TYPES = new Set([
  'LubanInput',
  'LubanTextArea',
  'LubanSelect',
  'LubanCheckbox',
  'LubanRadioGroup',
  'LubanSwitch',
]);

const props = defineProps<{
  root: NodeSchema;
  formState: Record<string, unknown>;
}>();

function getFormValue(name: string | undefined): unknown {
  if (name == null) return undefined;
  return props.formState[name];
}

function setFormValue(name: string | undefined, value: unknown): void {
  if (name != null && name in props.formState) {
    (props.formState as Record<string, unknown>)[name] = value;
  }
}

function isFormValueType(type: string): boolean {
  return FORM_VALUE_TYPES.has(type);
}
</script>

<template>
  <template v-if="root">
    <!-- Form value components: bind v-model to formState -->
    <component
      v-if="getComponent(root.type) && isFormValueType(root.type)"
      :is="getComponent(root.type)"
      v-bind="(root.props ?? {}) as Record<string, unknown>"
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
    >
      <RuntimeRenderer
        v-for="child in (root.children ?? [])"
        :key="child.id"
        :root="child"
        :form-state="formState"
      />
    </component>
    <!-- Non-form components: props only -->
    <component
      v-else-if="getComponent(root.type)"
      :is="getComponent(root.type)"
      v-bind="(root.props ?? {}) as Record<string, unknown>"
    >
      <RuntimeRenderer
        v-for="child in (root.children ?? [])"
        :key="child.id"
        :root="child"
        :form-state="formState"
      />
    </component>
    <template v-else>
      <RuntimeRenderer
        v-for="child in (root.children ?? [])"
        :key="child.id"
        :root="child"
        :form-state="formState"
      />
    </template>
  </template>
</template>
