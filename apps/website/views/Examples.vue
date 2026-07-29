<script setup lang="ts">
import PageShell from '~/components/PageShell.vue';
</script>
<template>
  <PageShell title="Examples — Luban" description="Templates and examples built with Luban.">
    <section style="padding:80px 0">
      <div class="ps-container" style="text-align:center">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Examples</span>
        <h1 style="font-size:40px;font-weight:800;margin-bottom:16px">Templates for every need</h1>
        <p style="font-size:17px;color:#64748b;max-width:600px;margin:0 auto 48px">Start with a template and customize. All templates use Luban components.</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1000px;margin:0 auto;text-align:left">
          <div v-for="t in templates" :key="t.title" style="padding:28px;border-radius:12px;border:1px solid #e2e8f0;transition:all .2s;cursor:pointer" @mouseenter="(e) => { const t = e.currentTarget as HTMLElement; t.style.borderColor='#818cf8';t.style.boxShadow='0 10px 15px -3px rgba(0,0,0,.06)';t.style.transform='translateY(-2px)' }" @mouseleave="(e) => { const t = e.currentTarget as HTMLElement; t.style.borderColor='#e2e8f0';t.style.boxShadow='';t.style.transform='' }">
            <div style="font-size:32px;margin-bottom:12px">{{ t.icon }}</div>
            <h3 style="font-size:17px;font-weight:700;margin-bottom:6px">{{ t.title }}</h3>
            <p style="font-size:14px;color:#64748b;line-height:1.6">{{ t.desc }}</p>
          </div>
        </div>
        <p style="margin-top:40px;font-size:14px;color:#64748b">More templates coming soon. <a href="/docs/getting-started" style="color:#4f46e5;font-weight:600">Build your own &rarr;</a></p>
      </div>
    </section>
  </PageShell>
</template>
<script lang="ts">
const templates = [
  { icon:'🏪',title:'E-Commerce Store',desc:'Product grid, shopping cart, checkout flow, order tracking. A complete online store built with Luban components.' },
  { icon:'📊',title:'Admin Dashboard',desc:'Data tables with pagination, KPI stats cards, form CRUD modals, user management — all you need for internal tools.' },
  { icon:'📢',title:'Marketing Landing',desc:'Hero banner with CTA, feature grid, pricing table, testimonials carousel, and lead capture form.' },
  { icon:'🏢',title:'Company Website',desc:'Professional corporate site with team section, service descriptions, contact form and location map.' },
  { icon:'📝',title:'Blog Platform',desc:'Article listing with filters, rich content pages, sidebar navigation and RSS feed integration.' },
  { icon:'🎓',title:'Course Platform',desc:'Video lessons, progress tracking, quiz forms, and student dashboard for online education.' },
];
</script>
