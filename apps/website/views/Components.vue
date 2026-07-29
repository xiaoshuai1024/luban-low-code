<script setup lang="ts">
import PageShell from '~/components/PageShell.vue';
</script>
<template>
  <PageShell title="Components — Luban" description="75+ Material Design components for building modern web apps.">
    <section style="padding: 80px 0">
      <div class="ps-container" style="text-align:center">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Component Library</span>
        <h1 style="font-size:40px;font-weight:800;letter-spacing:-.5px;margin-bottom:16px">75+ production-ready<br>Material Design components</h1>
        <p style="font-size:17px;color:#64748b;max-width:600px;margin:0 auto 48px;line-height:1.7">Every component is self-contained, customizable, and works across all screen sizes. Built with Vue 3 and SCSS.</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:1000px;margin:0 auto">
          <div v-for="c in comps" :key="c" style="padding:14px 16px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-weight:500;transition:all .15s;cursor:default" @mouseenter="(e) => { const t = e.target as HTMLElement; t.style.borderColor='#4f46e5';t.style.color='#4f46e5';t.style.background='#eef2ff' }" @mouseleave="(e) => { const t = e.target as HTMLElement; t.style.borderColor='#e2e8f0';t.style.color='';t.style.background='' }">{{ c }}</div>
        </div>
      </div>
    </section>
  </PageShell>
</template>
<script lang="ts">
const comps = ['🧭 Navbar','🦸 Hero','🎯 CTA','📊 Stats','📋 Table','📝 Form','✏️ Input','✅ Select','⬜ Button','📄 Card','🖼 Image','🔗 Link','📑 Tabs','📐 Row/Col','🧩 Container','🔔 Modal','📌 Drawer','💬 Toast','⚠️ Alert','❓ FAQ','⭐ Rating','🔄 Carousel','📈 Gallery','💳 Pricing','📝 Markdown','💻 CodeBlock','🪜 Steps','⬆ BackToTop','🔢 Countdown','🎫 Coupon','🏷 Tag','↔ Divider'];
</script>
