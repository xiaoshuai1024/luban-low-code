<script setup lang="ts">
useHead({
  title: 'Luban — Open-Source Low-Code Platform',
  meta: [
    { name: 'description', content: 'Drag-and-drop visual builder with 75+ Material Design components. Connect any database. Deploy anywhere. Open-source. Vue 3 + Spring Boot.' },
    { property: 'og:title', content: 'Luban — Open-Source Low-Code Platform' },
    { property: 'og:description', content: 'Visual low-code builder with 75+ components' },
    { property: 'og:type', content: 'website' },
  ],
  htmlAttrs: { lang: 'en' },
});

const features = [
  { icon: '🎨', title: 'Visual Builder', desc: 'Drag-and-drop interface with real-time preview. No coding required for layouts.' },
  { icon: '📚', title: '75+ Components', desc: 'Buttons, forms, tables, charts — a complete Material Design component library.' },
  { icon: '⚡', title: 'SSR Ready', desc: 'Nuxt Nitro server-side rendering. SEO-friendly, fast loading.' },
  { icon: '🤖', title: 'AI Powered', desc: 'Describe your page in natural language. DeepSeek generates the schema.' },
  { icon: '📊', title: 'Data Driven', desc: 'Connect MySQL, PostgreSQL, or REST APIs with visual query builder.' },
  { icon: '🌐', title: 'Multi-Platform', desc: 'Build once, render everywhere. Desktop, tablet, mobile.' },
];

const comps = [
  '🧭 Navbar', '🦸 Hero', '🎯 CTA', '📊 Stats', '📋 Table', '📝 Form', '✏️ Input', '✅ Select',
  '⬜ Button', '📄 Card', '🖼 Image', '🔗 Link', '📑 Tabs', '📐 Row/Col', '🧩 Container', '🔔 Modal',
  '📌 Drawer', '💬 Toast', '⚠️ Alert', '❓ FAQ', '⭐ Rating', '🔄 Carousel', '📈 Gallery', '💳 Pricing',
  '📝 Markdown', '💻 CodeBlock', '🪜 Steps', '⬆ BackToTop',
];
</script>

<template>
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1e293b;line-height:1.6;background:#fff">
    <!-- Nav -->
    <nav style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid #e2e8f0;height:64px;display:flex;align-items:center;padding:0 24px">
      <div style="max-width:1200px;margin:0 auto;width:100%;display:flex;align-items:center;justify-content:space-between">
        <a href="/" style="font-size:22px;font-weight:800;color:#4f46e5;text-decoration:none;letter-spacing:-.5px">Luban</a>
        <div style="display:flex;gap:28px;align-items:center">
          <a href="#features" style="font-size:14px;font-weight:500;color:#64748b;text-decoration:none">Features</a>
          <a href="#components" style="font-size:14px;font-weight:500;color:#64748b;text-decoration:none">Components</a>
          <a href="docs/" style="font-size:14px;font-weight:500;color:#64748b;text-decoration:none">Docs</a>
          <a href="storybook/" style="font-size:14px;font-weight:500;color:#64748b;text-decoration:none">Storybook</a>
          <a href="https://github.com/xiaoshuai1024/luban-low-code" target="_blank" style="font-size:14px;font-weight:500;color:#64748b;text-decoration:none">GitHub</a>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section style="padding:160px 0 80px;text-align:center;position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 0,rgba(79,70,229,.08) 0,transparent 50%)">
      <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:100px;background:rgba(79,70,229,.08);color:#4f46e5;font-size:13px;font-weight:600;margin-bottom:24px">
        <span style="width:8px;height:8px;border-radius:50%;background:#4f46e5;display:inline-block" /> Open Source · MIT License
      </div>
      <h1 style="font-size:56px;font-weight:800;letter-spacing:-1.5px;line-height:1.15;margin:0 auto 20px;background:linear-gradient(135deg,#4f46e5 0%,#06b6d4 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;max-width:800px">Build Apps at the Speed<br>of Thought</h1>
      <p style="font-size:18px;color:#64748b;max-width:640px;margin:0 auto 40px;line-height:1.7">Drag-and-drop visual builder with 75+ Material Design components. Connect any database. Deploy anywhere. Open-source. Vue 3 + Spring Boot.</p>
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
        <a href="https://github.com" target="_blank" style="padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;background:#4f46e5;color:#fff;transition:all .15s">⭐ Star on GitHub</a>
        <a href="#features" style="padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;background:transparent;border:1.5px solid #e2e8f0;color:#1e293b;transition:all .15s">Explore Features →</a>
      </div>
      <div style="display:flex;gap:48px;justify-content:center;margin-top:64px;flex-wrap:wrap">
        <div style="text-align:center"><div style="font-size:32px;font-weight:700">75+</div><div style="font-size:13px;color:#64748b;margin-top:4px">Components</div></div>
        <div style="text-align:center"><div style="font-size:32px;font-weight:700">Vue 3</div><div style="font-size:13px;color:#64748b;margin-top:4px">Framework</div></div>
        <div style="text-align:center"><div style="font-size:32px;font-weight:700">MIT</div><div style="font-size:13px;color:#64748b;margin-top:4px">License</div></div>
        <div style="text-align:center"><div style="font-size:32px;font-weight:700">SSR</div><div style="font-size:13px;color:#64748b;margin-top:4px">Rendering</div></div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" style="padding:80px 24px">
      <div style="max-width:1200px;margin:0 auto;text-align:center">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Platform</span>
        <h2 style="font-size:36px;font-weight:800;letter-spacing:-.5px;line-height:1.25;margin:0 0 16px">Everything you need to build<br>modern web applications</h2>
        <p style="font-size:17px;color:#64748b;max-width:600px;margin:0 auto 48px">From landing pages to complex dashboards — all powered by a unified visual builder.</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:left">
          <div v-for="f in features" :key="f.title" style="padding:32px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;transition:all .2s">
            <div style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:20px;background:#eef2ff;color:#4f46e5">{{ f.icon }}</div>
            <h3 style="font-size:17px;font-weight:700;margin:0 0 8px">{{ f.title }}</h3>
            <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Components -->
    <section id="components" style="padding:80px 24px;background:#f8fafc">
      <div style="max-width:1000px;margin:0 auto;text-align:center">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Component Library</span>
        <h2 style="font-size:36px;font-weight:800;margin:0 0 16px">75+ Production-Ready<br>Material Design Components</h2>
        <p style="font-size:17px;color:#64748b;max-width:600px;margin:0 auto 48px">Self-contained, customizable, works across all screen sizes.</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          <div v-for="c in comps" :key="c" style="padding:14px 16px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-weight:500;transition:all .15s;cursor:default">{{ c }}</div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section style="padding:100px 24px;background:#0f172a;color:#f1f5f9;text-align:center">
      <div style="max-width:600px;margin:0 auto">
        <h2 style="font-size:36px;font-weight:800;margin:0 0 16px;color:#fff">Ready to try?</h2>
        <p style="font-size:17px;color:rgba(255,255,255,.6);line-height:1.7;margin:0 0 32px">Star the repo, read the docs, or run locally in 2 minutes.</p>
        <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
          <a href="docs/" style="padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;background:#fff;color:#4f46e5;transition:all .15s">📖 Read the Docs</a>
          <a href="storybook/" style="padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;background:transparent;border:1.5px solid rgba(255,255,255,.3);color:#fff;transition:all .15s">🎨 Component Preview</a>
          <a href="https://github.com/xiaoshuai1024/luban-low-code" target="_blank" style="padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;background:transparent;border:1.5px solid rgba(255,255,255,.3);color:#fff;transition:all .15s">⭐ GitHub</a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer style="background:#0f172a;color:#f1f5f9;padding:48px 24px 24px;text-align:center;font-size:13px;border-top:1px solid rgba(255,255,255,.08)">
      <p style="margin:0 0 12px;color:rgba(255,255,255,.5)">Built with Vue 3 · Vite · Nuxt · Spring Boot · Open Source under MIT License</p>
      <p style="margin:0;color:rgba(255,255,255,.4)">&copy; 2026 Luban</p>
    </footer>
  </div>
</template>
