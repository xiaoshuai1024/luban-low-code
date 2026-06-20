<script setup lang="ts">
import { LubanPage } from "luban-low-code";
import type { PageSchema } from "luban-low-code";
import { DEFAULT_SITE_SLUG } from "~/utils/routes";
import { useSitePageStore } from "~/stores/sitePage";
import type { SubmitConfig } from "~/composables/useLeadSubmit";

const config = useRuntimeConfig().public;
const defaultSiteSlug = (config.defaultSiteSlug as string) || DEFAULT_SITE_SLUG;
const sitePageStore = useSitePageStore();
const route = useRoute();

// 路由模式 /:site/:path* —— site 为单段，path* 为多段（数组）。
// 不依赖 props 传参（props:true 与通配 path* 不兼容，会把数组原样透传），
// 改为直接读 route.params 并规范化为字符串。
const siteSlug = computed(() => {
  const s = route.params.site;
  const val = Array.isArray(s) ? s[0] : s;
  return val || defaultSiteSlug;
});
const path = computed(() => {
  const p = route.params.path;
  const segs = Array.isArray(p) ? p : p != null ? [p] : [];
  if (segs.length === 0) return "/";
  const joined = segs.join("/");
  return joined.startsWith("/") ? joined : `/${joined}`;
});

const { data: page, error, status } = usePageByPath(siteSlug, path);

const schema = computed<PageSchema | null>(() => page.value?.schema ?? null);

watch([page, error], () => {
  sitePageStore.setPage(siteSlug.value, path.value, page.value ?? null, error.value ?? null);
}, { immediate: true });

onBeforeUnmount(() => {
  sitePageStore.clearPage();
});

useHead({
  title: () => page.value?.name ?? "Page",
});

// --- Lead form submit handling ---

/** Extract submitConfig from the page schema's LubanForm node */
const formSubmitConfig = computed<SubmitConfig | null>(() => {
  if (!page.value?.schema?.root) return null;
  return extractSubmitConfig(page.value.schema.root);
});

/** Walk the schema tree to find LubanForm/LubanLeadCapture's submit config and formId */
function extractSubmitConfig(node: any): SubmitConfig | null {
  // D15-E3：LubanLeadCapture 也走同一提交链路（RuntimeRenderer @submit 分支已扩展）
  if (
    (node.type === "LubanForm" || node.type === "LubanLeadCapture") &&
    node.props?.submitConfig
  ) {
    return node.props.submitConfig as SubmitConfig;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = extractSubmitConfig(child);
      if (found) return found;
    }
  }
  return null;
}

/** Collect contact field values from formState */
function collectContact(formState: Record<string, unknown>): Record<string, unknown> {
  const contact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formState)) {
    if (value !== undefined && value !== null && value !== "") {
      contact[key] = value;
    }
  }
  return contact;
}

const {
  submitting,
  success: _submitSuccess,
  error: _submitError,
  result: _submitResult,
  submit: doLeadSubmit,
  reset: resetSubmit,
} = useLeadSubmit({
  onSuccess(result) {
    // Handle redirect / popup / toast modes
    const cfg = formSubmitConfig.value;
    if (cfg?.mode === "redirect" && cfg.redirectUrl) {
      navigateTo(cfg.redirectUrl, { external: true });
    } else if (cfg?.mode === "popup") {
      showPopup.value = true;
    } else if (cfg?.mode === "toast") {
      showToast.value = true;
      setTimeout(() => { showToast.value = false; }, 3000);
    }
  },
  onError(err) {
    showError.value = true;
    toastMessage.value = err.message;
  },
});

const showPopup = ref(false);
const showToast = ref(false);
const showError = ref(false);
const toastMessage = ref("");

/** Form submit handler — injected via provide for RuntimeRenderer */
function handleFormSubmit(payload: { formId: string; formState: Record<string, unknown> }) {
  if (!payload.formId) {
    console.warn("[DynamicPage] LubanForm has no formId prop, skipping submission");
    return;
  }
  const contact = collectContact(payload.formState);
  if (Object.keys(contact).length === 0) {
    toastMessage.value = "请填写至少一个字段";
    showError.value = true;
    setTimeout(() => { showError.value = false; }, 3000);
    return;
  }
  doLeadSubmit(payload.formId, contact);
}

provide("lubanFormSubmit", handleFormSubmit);

function dismissPopup() {
  showPopup.value = false;
  resetSubmit();
}

function dismissToast() {
  showToast.value = false;
}

function dismissError() {
  showError.value = false;
}
</script>

<template>
  <div class="luban-website-page">
    <template v-if="status === 'pending'">
      <div class="loading">Loading...</div>
    </template>
    <template v-else-if="error">
      <div class="error">
        <h1>Page not found</h1>
        <p>{{ error.message || "The requested page could not be loaded." }}</p>
      </div>
    </template>
    <template v-else-if="schema?.root">
      <ClientOnly>
        <LubanPage :schema="schema" />
        <template #fallback>
          <div class="loading">Loading...</div>
        </template>
      </ClientOnly>

      <!-- Loading overlay during submission -->
      <Teleport to="body">
        <div v-if="submitting" class="overlay">
          <div class="overlay__spinner">提交中...</div>
        </div>
      </Teleport>

      <!-- Success popup -->
      <Teleport to="body">
        <div v-if="showPopup" class="overlay" @click.self="dismissPopup">
          <div class="popup">
            <h2 class="popup__title">
              {{ formSubmitConfig?.popupTitle || "提交成功" }}
            </h2>
            <p class="popup__content">
              {{ formSubmitConfig?.popupContent || "感谢您的提交，我们会尽快与您联系。" }}
            </p>
            <button class="popup__btn" @click="dismissPopup">确定</button>
          </div>
        </div>
      </Teleport>

      <!-- Success toast -->
      <Teleport to="body">
        <div v-if="showToast" class="toast toast--success" @click="dismissToast">
          {{ formSubmitConfig?.toastMessage || "提交成功" }}
        </div>
      </Teleport>

      <!-- Error toast -->
      <Teleport to="body">
        <div v-if="showError" class="toast toast--error" @click="dismissError">
          {{ toastMessage || "提交失败，请稍后重试" }}
        </div>
      </Teleport>
    </template>
    <template v-else>
      <div class="error">
        <h1>Page not found</h1>
        <p>No content available for this path.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.luban-website-page {
  min-height: 100vh;
  position: relative;
}
.loading,
.error {
  padding: 2rem;
  text-align: center;
}
.error {
  color: #c00;
}
</style>

<style>
/* Global styles for teleported overlays */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.overlay__spinner {
  background: #fff;
  padding: 1.5rem 2rem;
  border-radius: 8px;
  font-size: 1.125rem;
}
.popup {
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}
.popup__title {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
}
.popup__content {
  margin: 0 0 1.5rem;
  color: #555;
  font-size: 0.9375rem;
  line-height: 1.5;
}
.popup__btn {
  padding: 0.5rem 2rem;
  border: none;
  border-radius: 6px;
  background: #409eff;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}
.popup__btn:hover {
  background: #3070cc;
}
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 0.9375rem;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
.toast--success {
  background: #67c23a;
  color: #fff;
}
.toast--error {
  background: #f56c6c;
  color: #fff;
}
</style>
