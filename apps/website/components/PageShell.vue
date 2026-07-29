<script setup lang="ts">
/**
 * PageShell — shared layout wrapper for all secondary pages.
 * Provides consistent Nav + Footer matching the homepage prototype.
 */
const props = withDefaults(defineProps<{ title?: string; description?: string }>(), { title: 'Luban', description: '' });

useHead(() => ({
  title: props.title || 'Luban',
  meta: props.description ? [{ name: 'description', content: props.description }] : undefined,
}));
</script>

<template>
  <div class="page-shell">
    <!-- Nav -->
    <nav class="ps-nav">
      <div class="ps-container">
        <a href="/" class="ps-nav-logo">Luban</a>
        <div class="ps-nav-links">
          <a href="/#features">Features</a>
          <a href="/components">Components</a>
          <a href="/docs">Docs</a>
          <a href="/examples">Examples</a>
          <a href="/open-source">Open Source</a>
          <a href="/#how">How it Works</a>
        </div>
      </div>
    </nav>

    <!-- Content -->
    <main class="ps-main">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="ps-footer">
      <div class="ps-container">
        <div class="ps-footer-grid">
          <div>
            <div class="ps-footer-logo">Luban</div>
            <p class="ps-footer-desc">Open-source low-code platform with 75+ Material Design components.</p>
          </div>
          <div><h4>Product</h4><a href="/#features">Features</a><a href="/components">Components</a><a href="/#templates">Templates</a><a href="/docs/api">API</a></div>
          <div><h4>Resources</h4><a href="/docs">Docs</a><a href="/docs/getting-started">Getting Started</a><a href="/docs/architecture">Architecture</a><a href="/examples">Examples</a></div>
          <div><h4>Community</h4><a href="/open-source">Open Source</a><a href="https://github.com">GitHub</a><a href="/open-source">Roadmap</a></div>
          <div><h4>Legal</h4><a href="/open-source">MIT License</a></div>
        </div>
        <div class="ps-footer-bottom"><span>&copy; 2026 Luban.</span><span>Made with &#x2764; for developers</span></div>
      </div>
    </footer>
  </div>
</template>

<style>
.page-shell {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1e293b; background: #fff; min-height: 100vh; display: flex; flex-direction: column;
}
.ps-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
/* Nav */
.ps-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(255,255,255,.85); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0; }
.ps-nav .ps-container { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.ps-nav-logo { font-size: 22px; font-weight: 800; color: #4f46e5; text-decoration: none; letter-spacing: -.5px; }
.ps-nav-links { display: flex; gap: 28px; align-items: center; }
.ps-nav-links a { font-size: 14px; font-weight: 500; color: #64748b; text-decoration: none; transition: color .15s; }
.ps-nav-links a:hover { color: #1e293b; }
/* Main */
.ps-main { flex: 1; padding-top: 64px; }
/* Footer */
.ps-footer { background: #0f172a; color: #f1f5f9; padding: 64px 0 32px; }
.ps-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 48px; }
.ps-footer h4 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; color: rgba(255,255,255,.5); }
.ps-footer a { display: block; font-size: 14px; color: rgba(255,255,255,.7); margin-bottom: 10px; text-decoration: none; transition: color .15s; }
.ps-footer a:hover { color: #fff; }
.ps-footer-logo { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 12px; }
.ps-footer-desc { font-size: 14px; color: rgba(255,255,255,.5); line-height: 1.7; }
.ps-footer-bottom { margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,.08); font-size: 13px; color: rgba(255,255,255,.4); display: flex; justify-content: space-between; }
@media (max-width: 768px) { .ps-footer-grid { grid-template-columns: 1fr; } }
</style>
