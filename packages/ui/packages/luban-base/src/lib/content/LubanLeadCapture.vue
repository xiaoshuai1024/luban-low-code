<script setup lang="ts">
/**
 * LubanLeadCapture — 线索采集区块（D15-E2 升级：接入提交链路）。
 *
 * 关键改造（原为死路表单）：
 *  - 输入加 v-model 绑本地 form 对象（name/phone/email/message）；
 *  - <form @submit.prevent="onSubmit"> 调 onSubmit；
 *  - onSubmit emit('submit', collectedFields) —— 由 RuntimeRenderer 的 @submit
 *    转发到 website 端 lubanFormSubmit handler，最终 POST /api/forms/:id/submit。
 *  - formId 由 material propsSchema 注入（RuntimeRenderer 从 root.props.formId 读取）。
 *  - 提交后显示成功态（successMessage），避免重复提交。
 *
 * 注：LeadCapture 不是 form-value type（不在 FORM_VALUE_TYPES），不走 RuntimeRenderer
 * 的 formState 收集；它自带 v-model 收集字段，通过 submit 事件把字段 map 传出，
 * RuntimeRenderer 包装为 { formId, formState } 调用 handler（formState=字段 map）。
 */
import { reactive, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 区块标题 */
    heading: string;
    /** 区块描述 */
    description?: string;
    /** 提交按钮文字 */
    submitText?: string;
    /** 占位提示（底部宽输入框） */
    placeholder?: string;
    /** 背景色 */
    backgroundColor?: string;
    /** 是否显示姓名输入 */
    showName?: boolean;
    /** 是否显示手机号输入 */
    showPhone?: boolean;
    /** 是否显示邮箱输入 */
    showEmail?: boolean;
    /** 关联表单 ID（提交链路用；RuntimeRenderer 从 root.props.formId 读取并传入 handler） */
    formId?: string;
    /** 提交成功提示文案 */
    successText?: string;
  }>(),
  {
    description: '',
    submitText: '提交',
    placeholder: '请输入您的联系方式',
    backgroundColor: 'var(--lb-bg-muted)',
    showName: true,
    showPhone: true,
    showEmail: false,
    formId: '',
    successText: '提交成功，我们会尽快与您联系',
  }
);

const emit = defineEmits<{
  /**
   * 提交事件：payload 为收集到的字段 map（name/phone/email/message 等）。
   * RuntimeRenderer 的 @submit 监听器把它包装为 { formId, formState } 调
   * lubanFormSubmit handler。
   */
  (e: 'submit', fields: Record<string, unknown>): void;
}>();

/** 本地表单字段（v-model 双向）。字段名与后端 lead contact 字段对齐。 */
const form = reactive<{
  name: string;
  phone: string;
  email: string;
  message: string;
}>({
  name: '',
  phone: '',
  email: '',
  message: '',
});

/** 提交中 / 已提交成功态。 */
const submitting = ref(false);
const submitted = ref(false);

/** 简单必填校验：手机号或邮箱至少一项填写。 */
function validate(): string | null {
  if (props.showPhone && !form.phone && props.showEmail && !form.email) {
    return '请填写手机号或邮箱';
  }
  if (props.showPhone && props.showEmail && !form.phone && !form.email) {
    return '请填写手机号或邮箱';
  }
  return null;
}

function onSubmit(): void {
  if (submitting.value || submitted.value) return;
  const err = validate();
  if (err) return; // 校验失败不提交（前端静默；后端另有校验）
  // 仅收集非空字段，避免空字符串污染 contact
  const fields: Record<string, unknown> = {};
  if (props.showName && form.name) fields.name = form.name;
  if (props.showPhone && form.phone) fields.phone = form.phone;
  if (props.showEmail && form.email) fields.email = form.email;
  if (form.message) fields.message = form.message;
  submitting.value = true;
  // emit submit：RuntimeRenderer 转发到 lubanFormSubmit handler（异步由 handler 处理）。
  // 本组件不直接调 API（保持纯展示 + 事件驱动，与 LubanForm 一致）。
  emit('submit', fields);
  // 成功态：handler 在 website 端为异步，这里乐观置成功态（handler 失败由 website 弹错误）。
  submitted.value = true;
  submitting.value = false;
}
</script>

<template>
  <section class="lb-lead-capture" :style="{ backgroundColor }">
    <div class="lb-lead-capture__content">
      <h2 class="lb-lead-capture__heading">{{ heading }}</h2>
      <p v-if="description" class="lb-lead-capture__description">{{ description }}</p>

      <!-- 成功态 -->
      <div v-if="submitted" class="lb-lead-capture__success">
        {{ successText }}
      </div>

      <!-- 表单态 -->
      <form v-else class="lb-lead-capture__form" @submit.prevent="onSubmit">
        <div class="lb-lead-capture__fields">
          <input
            v-if="showName"
            v-model="form.name"
            type="text"
            name="name"
            class="lb-lead-capture__input"
            placeholder="姓名"
          />
          <input
            v-if="showPhone"
            v-model="form.phone"
            type="tel"
            name="phone"
            class="lb-lead-capture__input"
            placeholder="手机号"
          />
          <input
            v-if="showEmail"
            v-model="form.email"
            type="email"
            name="email"
            class="lb-lead-capture__input"
            placeholder="邮箱"
          />
        </div>
        <div class="lb-lead-capture__action">
          <input
            v-model="form.message"
            type="text"
            name="message"
            class="lb-lead-capture__input lb-lead-capture__input--wide"
            :placeholder="placeholder"
          />
          <button
            type="submit"
            class="lb-lead-capture__submit"
            :disabled="submitting"
          >
            {{ submitting ? '提交中…' : submitText }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-lead-capture {
  padding: 40px 24px;
  width: 100%;
}
.lb-lead-capture__content {
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
}
.lb-lead-capture__heading {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--lb-text-heading);
}
.lb-lead-capture__description {
  font-size: 0.95rem;
  color: var(--lb-text-muted);
  margin: 0 0 20px;
  line-height: 1.5;
}
.lb-lead-capture__success {
  padding: 20px;
  background: var(--lb-success-bg);
  color: var(--lb-success-text);
  border-radius: 6px;
  font-size: 0.95rem;
}
.lb-lead-capture__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lb-lead-capture__fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lb-lead-capture__input {
  padding: 10px 14px;
  border: 1px solid var(--lb-border-strong);
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
  &:focus { border-color: var(--lb-accent); }
  &--wide { flex: 1; }
}
.lb-lead-capture__action {
  display: flex;
  gap: 8px;
}
.lb-lead-capture__submit {
  padding: 10px 24px;
  background: var(--lb-accent);
  color: var(--lb-accent-contrast);
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}
</style>
