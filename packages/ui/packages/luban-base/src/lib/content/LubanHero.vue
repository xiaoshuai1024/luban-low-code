<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 主标题 */
    title: string;
    /** 副标题 */
    subtitle?: string;
    /** 眉标（小标签，标题上方） */
    eyebrow?: string;
    /** CTA 按钮文字 */
    ctaText?: string;
    /** CTA 按钮链接 */
    ctaUrl?: string;
    /** 次级 CTA 按钮文字（D15-E2 升级） */
    secondaryCtaText?: string;
    /** 次级 CTA 按钮链接 */
    secondaryCtaUrl?: string;
    /** 背景图片 URL */
    backgroundImage?: string;
    /** 背景色（背景图未设置时生效） */
    backgroundColor?: string;
    /** 文字颜色 */
    textColor?: string;
    /** 高度（如 '400px' / '60vh'） */
    height?: string;
    /** 对齐方式 */
    align?: 'left' | 'center' | 'right';
    /** 布局变体（D15-E2 升级：centered 居中 / split 左文右图） */
    layout?: 'centered' | 'split';
    /** split 布局下的右侧图片 */
    sideImage?: string;
  }>(),
  {
    subtitle: '',
    eyebrow: '',
    ctaText: '了解更多',
    ctaUrl: '',
    secondaryCtaText: '',
    secondaryCtaUrl: '',
    backgroundImage: '',
    backgroundColor: 'var(--lb-bg-dark)',
    textColor: 'var(--lb-text-on-dark)',
    height: '400px',
    align: 'center',
    layout: 'centered',
    sideImage: '',
  }
);
</script>

<template>
  <section
    class="lb-hero"
    :class="`lb-hero--${layout}`"
    :style="{
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
      backgroundColor: backgroundImage ? undefined : backgroundColor,
      minHeight: height,
      color: textColor,
    }"
  >
    <div class="lb-hero__overlay" v-if="backgroundImage && layout === 'centered'" />
    <div class="lb-hero__content" :style="{ textAlign: align }">
      <span v-if="eyebrow" class="lb-hero__eyebrow">{{ eyebrow }}</span>
      <h1 class="lb-hero__title">{{ title }}</h1>
      <p v-if="subtitle" class="lb-hero__subtitle">{{ subtitle }}</p>
      <div class="lb-hero__actions" :style="{ justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }">
        <a
          v-if="ctaText && ctaUrl"
          :href="ctaUrl"
          class="lb-hero__cta"
        >{{ ctaText }}</a>
        <span
          v-else-if="ctaText && !ctaUrl"
          class="lb-hero__cta lb-hero__cta--disabled"
        >{{ ctaText }}</span>
        <a
          v-if="secondaryCtaText && secondaryCtaUrl"
          :href="secondaryCtaUrl"
          class="lb-hero__cta lb-hero__cta--secondary"
        >{{ secondaryCtaText }}</a>
      </div>
    </div>
    <div v-if="layout === 'split' && sideImage" class="lb-hero__side">
      <img :src="sideImage" alt="" class="lb-hero__side-image" />
    </div>
  </section>
</template>

<style scoped lang="scss">
.lb-hero {
  position: relative; display: flex; align-items: center; justify-content: center;
  min-height: 200px; width: 100%; padding: 120px 24px 80px;
  background: radial-gradient(ellipse at 50% 0%, rgba(79,70,229,.06) 0%, transparent 60%);
  overflow: hidden;
  &--split { justify-content: space-between; gap: 32px; padding: 0 48px; .lb-hero__content { flex:1;max-width:560px; } }
}
.lb-hero__content { position:relative; z-index:1; max-width:800px; text-align:center; padding:0; }
.lb-hero__eyebrow { display:inline-block; font-size:.85rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--lb-primary); margin-bottom:16px; }
.lb-hero__title { font-size:3.5rem; font-weight:800; margin:0 0 20px; line-height:1.15; letter-spacing:-1.5px;
  background:linear-gradient(135deg,var(--lb-primary) 0%,var(--lb-accent) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.lb-hero__subtitle { font-size:1.15rem; color:var(--lb-text-secondary); margin:0 auto 32px; max-width:600px; line-height:1.7; }
.lb-hero__actions { display:flex; gap:16px; flex-wrap:wrap; justify-content:center; margin-top:8px; }
.lb-hero__cta { display:inline-block;padding:14px 32px;font-size:1rem;font-weight:600;border-radius:10px;text-decoration:none;transition:all .15s;cursor:pointer;
  background:var(--lb-primary);color:#fff;border:none; &:hover { background:#4338ca; transform:translateY(-1px); box-shadow:0 4px 12px rgba(79,70,229,.3); }
  &--secondary { background:transparent;color:var(--lb-text-primary);border:1.5px solid var(--lb-border);
    &:hover { border-color:var(--lb-primary);color:var(--lb-primary);background:transparent;box-shadow:none;transform:translateY(-1px); } }
  &--disabled { opacity:.6;cursor:default; }
}
.lb-hero__side { flex:0 0 40%;max-width:480px;position:relative;z-index:1; }
.lb-hero__side-image { width:100%;height:100%;max-height:480px;object-fit:cover;border-radius:8px; }
</style>
