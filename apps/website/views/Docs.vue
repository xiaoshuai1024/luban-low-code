<script setup lang="ts">
import PageShell from '~/components/PageShell.vue';
</script>
<template>
  <PageShell title="Documentation — Luban" description="Learn how to build with Luban.">
    <section style="padding:80px 0">
      <div class="ps-container" style="text-align:center">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Documentation</span>
        <h1 style="font-size:40px;font-weight:800;margin-bottom:16px">Learn Luban</h1>
        <p style="font-size:17px;color:#64748b;max-width:600px;margin:0 auto 48px">Everything you need to know to build, deploy, and extend your applications with Luban.</p>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:24px;max-width:800px;margin:0 auto;text-align:left">
          <div v-for="d in docs" :key="d.title" style="padding:28px;border-radius:12px;border:1px solid #e2e8f0;transition:all .2s;cursor:pointer" @mouseenter="(e) => { const t = e.currentTarget as HTMLElement; t.style.borderColor='#818cf8';t.style.boxShadow='0 10px 15px -3px rgba(0,0,0,.06)';t.style.transform='translateY(-2px)' }" @mouseleave="(e) => { const t = e.currentTarget as HTMLElement; t.style.borderColor='#e2e8f0';t.style.boxShadow='';t.style.transform='' }" @click="window.location.href = d.href">
            <div style="font-size:24px;margin-bottom:12px">{{ d.icon }}</div>
            <h3 style="font-size:17px;font-weight:700;margin-bottom:6px">{{ d.title }}</h3>
            <p style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:12px">{{ d.desc }}</p>
            <a :href="d.href" style="font-size:13px;font-weight:600;color:#4f46e5;text-decoration:none">Read more &rarr;</a>
          </div>
        </div>
      </div>
    </section>
  </PageShell>
</template>
<script lang="ts">
const docs = [
  { icon:'🚀',title:'Getting Started',desc:'Build your first page from scratch in under 5 minutes. Covers the visual builder, components, and publishing.',href:'/docs/getting-started' },
  { icon:'🏗️',title:'Architecture',desc:'Understand the full stack: Engine (SPA), BFF (Next.js), Backend (Spring Boot), SSR (Nuxt), and UI Material Library.',href:'/docs/architecture' },
  { icon:'🔌',title:'API Reference',desc:'Complete API documentation for BFF public endpoints, admin CRUD, authentication, and error handling.',href:'/docs/api' },
  { icon:'📦',title:'Component Development',desc:'Learn how to build custom Material Design components. Covers props schema, registration, testing, and publishing.',href:'/docs/components' },
];
</script>
