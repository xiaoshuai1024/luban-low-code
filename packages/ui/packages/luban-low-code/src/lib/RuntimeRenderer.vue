<script setup lang="ts">
import { getComponent } from './registry';
import type { NodeSchema } from './schema';
import { validate, type ValidationRule } from './validation';
import { evaluate, evaluateBoolean, interpolate } from './expression';
import { createActionRunner, type ActionContext } from './action';
import { computed, inject } from 'vue';

/** Optional form submit handler provided by the host app (e.g. website DynamicPage) */
interface FormSubmitPayload {
  formId: string;
  formState: Record<string, unknown>;
  event: Event;
}
const formSubmitHandler = inject<((payload: FormSubmitPayload) => void) | null>('lubanFormSubmit', null);

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
    /** 表达式上下文（数据源数据等），与 formState 合并供 visible/loop/events 求值 */
    ctx?: Record<string, unknown>;
  }>(),
  { formErrors: () => ({}), ctx: () => ({}) }
);

/** 表达式求值上下文：数据源 ctx + $form（表单字段值，供 visible 等引用） */
const evalCtx = computed<Record<string, unknown>>(() => ({
  ...props.ctx,
  $form: props.formState,
}));

/** 条件渲染：visible 表达式求值（undefined/缺省=true；危险表达式默认 false 不渲染） */
function isNodeVisible(node: NodeSchema): boolean {
  return evaluateBoolean(node.visible, evalCtx.value);
}

/** 循环渲染：loop.data 求值为数组（表达式或字面量），按元素多次渲染本节点 */
const loopItems = computed<unknown[]>(() => {
  if (!props.root.loop) return [];
  const data = props.root.loop.data;
  const resolved = typeof data === 'string' ? evaluate(data, evalCtx.value) : data;
  return Array.isArray(resolved) ? resolved : [];
});
/** 去掉 loop 字段的 root 副本（递归渲染时不再触发 loop） */
const rootWithoutLoop = computed<NodeSchema>(() => {
  const { loop: _loop, ...rest } = props.root;
  return rest as NodeSchema;
});
/** 每次循环把 itemVar/keyVar 注入表达式上下文 */
function loopCtx(item: unknown, idx: number): Record<string, unknown> {
  const itemVar = props.root.loop?.itemVar ?? 'item';
  const keyVar = props.root.loop?.keyVar ?? 'index';
  return { ...evalCtx.value, [itemVar]: item, [keyVar]: idx };
}

/** 事件动作执行器（host 可 provide 'lubanActionRunner' 覆盖，如注入 router.navigate） */
const actionRunner = inject('lubanActionRunner', createActionRunner());

/** 把节点 events（事件名→动作表达式）解析为 v-on 可用的 handler map */
function resolveEvents(
  events: Record<string, string> | undefined,
): Record<string, (e: unknown) => void> {
  const out: Record<string, (e: unknown) => void> = {};
  if (!events) return out;
  for (const [eventName, actionExpr] of Object.entries(events)) {
    out[eventName] = () => {
      const actx: ActionContext = { vars: evalCtx.value };
      actionRunner.run(actionExpr, actx);
    };
  }
  return out;
}

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
  // 字符串 props 做 {{}} 插值（数据驱动：props 可引用 ctx/$form 变量）
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    out[k] = typeof v === 'string' ? interpolate(v, evalCtx.value) : v;
  }
  return out;
}

function slotContent(): string {
  const p = props.root.props;
  if (p?.content != null) return String(p.content);
  if (p?.text != null) return String(p.text);
  return '';
}
</script>

<template>
  <template v-if="root && isNodeVisible(root)">
    <!-- loop: 按 loop.data 数组重复渲染本节点（每 item 注入 ctx） -->
    <template v-if="root.loop && loopItems.length">
      <RuntimeRenderer
        v-for="(item, idx) in loopItems"
        :key="idx"
        :root="rootWithoutLoop"
        :form-state="formState"
        :form-errors="formErrors"
        :ctx="loopCtx(item, idx)"
      />
    </template>
    <!-- Form value components: bind v-model to formState + validation error -->
    <component
      v-else-if="!root.loop && getComponent(root.type) && isFormValueType(root.type)"
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
        :ctx="evalCtx"
      />
    </component>
    <!-- Non-form components: props only, optional slot from content/text -->
    <component
      v-else-if="getComponent(root.type)"
      :is="getComponent(root.type)"
      v-bind="componentProps(root.props as Record<string, unknown>)"
      v-on="resolveEvents(root.events)"
      @submit="
        formSubmitHandler && root.type === 'LubanForm'
          ? formSubmitHandler({
              formId: (root.props?.formId as string) || '',
              formState: props.formState,
              event: $event,
            })
          : undefined
      "
    >
      <template v-if="(root.children ?? []).length">
        <RuntimeRenderer
          v-for="child in (root.children ?? [])"
          :key="child.id"
          :root="child"
          :form-state="formState"
          :form-errors="formErrors"
          :ctx="evalCtx"
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
        :ctx="evalCtx"
      />
    </template>
  </template>
</template>
