<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 标题文字 */
    heading: string;
    /** 描述文字 */
    description?: string;
    /** 主按钮文字 */
    buttonText?: string;
    /** 主按钮链接 */
    buttonUrl?: string;
    /** 次按钮文字（D15-E2 升级） */
    secondaryButtonText?: string;
    /** 次按钮链接 */
    secondaryButtonUrl?: string;
    /** 背景色 */
    backgroundColor?: string;
    /** 文字颜色 */
    textColor?: string;
    /** 主按钮样式变体 */
    buttonVariant?: 'primary' | 'outline' | 'ghost';
    /** 是否占满容器宽度（D15-E2 升级） */
    fullWidth?: boolean;
  }>(),
  {
    description: '',
    buttonText: '立即行动',
    buttonUrl: '',
    secondaryButtonText: '',
    secondaryButtonUrl: '',
    // V2-T1: 默认值用 CSS 变量，支持运行时换肤；消费者仍可传字面量覆盖
    backgroundColor: 'var(--lb-accent)',
    textColor: 'var(--lb-accent-contrast)',
    buttonVariant: 'primary',
    fullWidth: false,
  }
);
</script>

<template>
  <section
    class="lb-cta"
    :class="{ 'lb-cta--full': fullWidth }"
    :style="{ backgroundColor, color: textColor }"
  >
    <div class="lb-cta__content">
      <h2 class="lb-cta__heading">{{ heading }}</h2>
      <p v-if="description" class="lb-cta__description">{{ description }}</p>
      <div class="lb-cta__actions">
        <a
          v-if="buttonText && buttonUrl"
          :href="buttonUrl"
          class="lb-cta__button"
          :class="`lb-cta__button--${buttonVariant}`"
        >{{ buttonText }}</a>
        <span
          v-else-if="buttonText && !buttonUrl"
          class="lb-cta__button lb-cta__button--disabled"
        >{{ buttonText }}</span>
        <a
          v-if="secondaryButtonText && secondaryButtonUrl"
          :href="secondaryButtonUrl"
          class="lb-cta__button lb-cta__button--secondary"
        >{{ secondaryButtonText }}</a>
        <span
          v-else-if="secondaryButtonText && !secondaryButtonUrl"
          class="lb-cta__button lb-cta__button--secondary lb-cta__button--disabled"
        >{{ secondaryButtonText }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-cta {
  width: 100%; text-align: center;
  &--full .lb-cta__content { max-width: none; }
}
.lb-cta__content {
  max-width: 1200px; margin: 0 auto; padding: 80px 24px;
  background: linear-gradient(135deg, var(--lb-primary) 0%, var(--lb-secondary) 100%);
  border-radius: 24px; color: #fff;
}
.lb-cta__heading { font-size: 2.25rem; font-weight: 800; margin: 0 0 16px; color: #fff; }
.lb-cta__description { font-size: 1.05rem; opacity: .85; margin: 0 auto 32px; max-width: 500px; line-height: 1.6; }
.lb-cta__actions { display: inline-flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.lb-cta__button { display:inline-block;padding:14px 32px;font-size:1rem;font-weight:600;border-radius:10px;text-decoration:none;transition:all .15s;
  &--primary { background:#fff;color:var(--lb-primary); &:hover { background:#f1f5f9; } }
  &--outline,&--secondary { background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.3); &:hover { background:rgba(255,255,255,.1);border-color:#fff; } }
  &--ghost { background:transparent;color:#fff; &:hover { text-decoration:underline; } }
  &--disabled { opacity:.6;cursor:default; }
}
</style>
