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
  position: relative;
  max-width: 1200px; margin: 0 auto; padding: 80px 24px;
  /* 极光流动渐变：indigo → violet → cyan 缓慢循环 */
  background: linear-gradient(120deg, #4f46e5, #7c3aed, #0891b2, #4f46e5);
  background-size: 300% 300%;
  animation: lb-cta-aurora 14s ease-in-out infinite;
  border-radius: 24px; color: #fff;
  overflow: hidden;
  /* 装饰光球 */
  &::before, &::after {
    content: ""; position: absolute; border-radius: 50%; filter: blur(64px); opacity: .35; pointer-events: none;
  }
  &::before { width: 300px; height: 300px; top: -120px; left: -60px; background: #22d3ee; }
  &::after  { width: 340px; height: 340px; bottom: -160px; right: -80px; background: #7c3aed; }
}
@keyframes lb-cta-aurora {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
.lb-cta__heading { font-size: 2.25rem; font-weight: 800; margin: 0 0 16px; color: #fff; position: relative; }
.lb-cta__description { font-size: 1.05rem; opacity: .85; margin: 0 auto 32px; max-width: 500px; line-height: 1.6; position: relative; }
.lb-cta__actions { display: inline-flex; gap: 16px; flex-wrap: wrap; justify-content: center; position: relative; }
.lb-cta__button { display:inline-block;padding:14px 32px;font-size:1rem;font-weight:600;border-radius:12px;text-decoration:none;transition:all .2s ease;
  &--primary { background:#fff;color:var(--lb-primary); box-shadow:0 4px 16px rgba(0,0,0,.18);
    &:hover { background:#f8fafc; transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.28); } }
  &--outline,&--secondary { background:rgba(255,255,255,.08);color:#fff;border:1.5px solid rgba(255,255,255,.35); backdrop-filter:blur(6px);
    &:hover { background:rgba(255,255,255,.16);border-color:#fff; transform:translateY(-2px); } }
  &--ghost { background:transparent;color:#fff; &:hover { text-decoration:underline; } }
  &--disabled { opacity:.6;cursor:default; }
}
@media (prefers-reduced-motion: reduce) {
  .lb-cta__content { animation: none; }
  .lb-cta__button { transition: none; }
}
</style>
