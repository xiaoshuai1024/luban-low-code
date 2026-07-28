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
  padding: 48px 24px;
  text-align: center;
  width: 100%;
  &--full .lb-cta__content { max-width: none; }
}
.lb-cta__content {
  max-width: 600px;
  margin: 0 auto;
}
.lb-cta__heading {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 12px;
}
.lb-cta__description {
  font-size: 1rem;
  opacity: 0.9;
  margin: 0 0 24px;
  line-height: 1.5;
}
.lb-cta__actions {
  display: inline-flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.lb-cta__button {
  display: inline-block;
  padding: 10px 28px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  &--primary {
    background: var(--lb-bg);
    color: var(--lb-accent);
    &:hover { opacity: 0.9; }
  }
  &--outline {
    background: transparent;
    color: var(--lb-accent-contrast);
    border: 2px solid var(--lb-accent-contrast);
    &:hover { background: rgba(255,255,255,0.1); }
  }
  &--ghost {
    background: transparent;
    color: var(--lb-accent-contrast);
    &:hover { text-decoration: underline; }
  }
  &--secondary {
    background: transparent;
    color: var(--lb-accent-contrast);
    border: 2px solid rgba(255,255,255,0.6);
    &:hover { background: rgba(255,255,255,0.1); }
  }
  &--disabled { opacity: 0.6; cursor: default; }
}
</style>
