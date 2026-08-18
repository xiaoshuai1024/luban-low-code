<script setup lang="ts">
// luban-low-code 组件通过 RuntimeRenderer 动态渲染，
// Nuxt/Vite CSS tree-shaking 无法自动收集 scoped 样式，
// 须在此全局导入（相对路径，避免 vite alias 指向 .js 导致路径错误）。
import '../../packages/ui/packages/luban-low-code/dist/index.css';
import '../../packages/ui/packages/luban-base/dist/index.css';

// 全局 loading 状态：SSR 首次渲染完成后自动隐藏
const nuxtApp = useNuxtApp();
const loading = ref(true);

// 当 Nuxt 挂载完成时关闭 loading
nuxtApp.hook('app:rendered', () => {
  // 仅首次渲染显示 loading，后续导航用 page transition
  setTimeout(() => { loading.value = false; }, 100);
});

// 页面切换时的 loading 状态
nuxtApp.hook('page:start', () => {
  loading.value = true;
});
nuxtApp.hook('page:finish', () => {
  setTimeout(() => { loading.value = false; }, 200);
});
</script>

<template>
  <div>
    <!-- Loading Overlay -->
    <Transition name="loader">
      <div v-if="loading" class="page-loader">
        <div class="page-loader__spinner">
          <div class="page-loader__logo">Luban</div>
          <div class="page-loader__dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Page content with transition -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- 访客 AI 助手（C 端问答，全局悬浮；e2e 契约 @J-ai-c-assist） -->
    <ClientOnly>
      <VisitorAi />
    </ClientOnly>
  </div>
</template>

<style>
/* Global unscoped styles — Vue scoped CSS cannot apply to :root */
html {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1e293b;
  line-height: 1.6;
}
body { font-family: inherit; color: inherit; line-height: inherit; }
</style>
<style scoped>
.page-loader { position:fixed;inset:0;z-index:9999;background:#fff;display:flex;align-items:center;justify-content:center; }
.page-loader__spinner { text-align:center; }
.page-loader__logo { font-size:36px;font-weight:800;color:#4f46e5;margin-bottom:24px;letter-spacing:-1px; }
.page-loader__dots { display:flex;gap:8px;justify-content:center; }
.page-loader__dots span { width:10px;height:10px;border-radius:50%;background:#4f46e5;animation:ldrPulse 1.4s infinite ease-in-out both; }
.page-loader__dots span:nth-child(1) { animation-delay:-0.32s; }
.page-loader__dots span:nth-child(2) { animation-delay:-0.16s; }
.page-loader__dots span:nth-child(3) { animation-delay:0s; }
@keyframes ldrPulse { 0%,80%,100%{transform:scale(0);opacity:.4} 40%{transform:scale(1);opacity:1} }
.loader-enter-active { transition:opacity .3s ease; }
.loader-leave-active { transition:opacity .5s ease; }
.loader-enter-from,.loader-leave-to { opacity:0; }
.page-enter-active { transition:opacity .2s ease,transform .2s ease; }
.page-leave-active { transition:opacity .15s ease; }
.page-enter-from { opacity:0;transform:translateY(8px); }
.page-leave-to { opacity:0; }
</style>
