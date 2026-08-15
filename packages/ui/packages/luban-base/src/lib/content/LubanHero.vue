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
    <!-- 极光装饰层：浮动渐变光球 + 网格底纹（背景图模式下隐藏） -->
    <div v-if="!backgroundImage" class="lb-hero__aurora" aria-hidden="true">
      <span class="lb-hero__orb lb-hero__orb--indigo" />
      <span class="lb-hero__orb lb-hero__orb--cyan" />
      <span class="lb-hero__orb lb-hero__orb--violet" />
      <span class="lb-hero__grid" />
    </div>
    <div class="lb-hero__overlay" v-if="backgroundImage && layout === 'centered'" />
    <div class="lb-hero__content" :style="{ textAlign: align }">
      <span v-if="eyebrow" class="lb-hero__eyebrow"><i class="lb-hero__pulse" aria-hidden="true" />{{ eyebrow }}</span>
      <h1 class="lb-hero__title">{{ title }}</h1>
      <p v-if="subtitle" class="lb-hero__subtitle">{{ subtitle }}</p>
      <div class="lb-hero__actions" :style="{ justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }">
        <a
          v-if="ctaText && ctaUrl"
          :href="ctaUrl"
          class="lb-hero__cta"
        >{{ ctaText }}<span class="lb-hero__cta-arrow" aria-hidden="true">→</span></a>
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
  overflow: hidden;
  &--split { justify-content: space-between; gap: 32px; padding: 0 48px; .lb-hero__content { flex:1;max-width:560px; } }
}

/* ===== 极光装饰层：三色浮动光球 + 网格底纹 ===== */
.lb-hero__aurora { position: absolute; inset: 0; pointer-events: none; }
.lb-hero__orb {
  position: absolute; border-radius: 50%; filter: blur(72px); opacity: .35;
  animation: lb-hero-float 12s ease-in-out infinite;
  &--indigo { width: 420px; height: 420px; top: -140px; left: 8%; background: #4f46e5; animation-delay: 0s; }
  &--cyan   { width: 360px; height: 360px; bottom: -160px; left: 38%; background: #06b6d4; opacity: .28; animation-delay: -4s; animation-duration: 15s; }
  &--violet { width: 400px; height: 400px; top: -100px; right: 6%; background: #7c3aed; opacity: .30; animation-delay: -8s; animation-duration: 18s; }
}
@keyframes lb-hero-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(36px, 28px) scale(1.08); }
  66%      { transform: translate(-28px, -20px) scale(.94); }
}
.lb-hero__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(79,70,229,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79,70,229,.05) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(ellipse at 50% 40%, #000 30%, transparent 72%);
  mask-image: radial-gradient(ellipse at 50% 40%, #000 30%, transparent 72%);
}

.lb-hero__overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,23,42,.55), rgba(15,23,42,.35)); }
.lb-hero__content { position:relative; z-index:1; max-width:800px; text-align:center; padding:0; }

/* 眉标：渐变 pill + 呼吸圆点 */
.lb-hero__eyebrow {
  display:inline-flex; align-items:center; gap:8px;
  font-size:.85rem; font-weight:700; letter-spacing:.08em;
  color:var(--lb-primary); margin-bottom:16px;
  padding: 6px 16px; border-radius: 999px;
  background: rgba(79,70,229,.08); border: 1px solid rgba(79,70,229,.18);
}
.lb-hero__pulse {
  width:8px; height:8px; border-radius:50%; background:var(--lb-primary);
  box-shadow: 0 0 0 0 rgba(79,70,229,.5);
  animation: lb-hero-pulse 2s ease-out infinite;
}
@keyframes lb-hero-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(79,70,229,.45); }
  70%  { box-shadow: 0 0 0 10px rgba(79,70,229,0); }
  100% { box-shadow: 0 0 0 0 rgba(79,70,229,0); }
}

/* 标题：三色流动渐变 */
.lb-hero__title {
  font-size:3.5rem; font-weight:800; margin:0 0 20px; line-height:1.15; letter-spacing:-1.5px;
  background: linear-gradient(110deg, #4f46e5 20%, #06b6d4 40%, #7c3aed 60%, #4f46e5 80%);
  background-size: 200% 100%;
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  animation: lb-hero-gradient 8s linear infinite;
}
@keyframes lb-hero-gradient {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.lb-hero__subtitle { font-size:1.15rem; color:var(--lb-text-secondary); margin:0 auto 32px; max-width:600px; line-height:1.7; }
.lb-hero__actions { display:flex; gap:16px; flex-wrap:wrap; justify-content:center; margin-top:8px; }
.lb-hero__cta {
  display:inline-flex; align-items:center; gap:8px;
  padding:14px 32px; font-size:1rem; font-weight:600; border-radius:12px;
  text-decoration:none; transition:all .2s ease; cursor:pointer;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color:#fff; border:none;
  box-shadow: 0 4px 14px rgba(79,70,229,.25);
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(79,70,229,.4);
    .lb-hero__cta-arrow { transform: translateX(4px); }
  }
  &--secondary {
    background:rgba(255,255,255,.7); color:var(--lb-text-primary);
    border:1.5px solid var(--lb-border); box-shadow:none;
    backdrop-filter: blur(6px);
    &:hover { border-color:var(--lb-primary); color:var(--lb-primary); background:#fff; box-shadow:none; transform:translateY(-2px); }
  }
  &--disabled { opacity:.6;cursor:default; }
}
.lb-hero__cta-arrow { display:inline-block; transition: transform .2s ease; }

.lb-hero__side { flex:0 0 40%;max-width:480px;position:relative;z-index:1; }
.lb-hero__side-image { width:100%;height:100%;max-height:480px;object-fit:cover;border-radius:8px; }

/* 无障碍：用户偏好减少动效时关闭装饰动画（内容与交互不受影响） */
@media (prefers-reduced-motion: reduce) {
  .lb-hero__orb, .lb-hero__pulse, .lb-hero__title { animation: none; }
}
</style>
