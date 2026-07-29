<script setup lang="ts">
import PageShell from '~/components/PageShell.vue';
</script>
<template>
  <PageShell title="Architecture — Luban" description="Luban system architecture.">
    <section style="padding:80px 0;max-width:800px;margin:0 auto">
      <div class="ps-container">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Architecture</span>
        <h1 style="font-size:40px;font-weight:800;margin-bottom:24px">System Architecture</h1>

        <div style="background:#f8fafc;border-radius:12px;padding:32px;margin-bottom:32px">
          <pre style="font-size:14px;line-height:1.8;font-family:'Fira Code',monospace;color:#1e293b">Browser
  ├── Engine (SPA)  —  Vue 3 · Vite · TypeScript · Port 4200
  │   Visual drag-and-drop designer + admin panel
  │
  ├── Website (SSR) —  Nuxt 3 · Nitro · Port 4173
  │   Server-side rendered public pages
  │
  │       ┌──── BFF (Next.js 16 · Port 3100) ────┐
  │       │   API aggregation · JWT auth · proxy  │
  └───────┴───────────────────────────────────────┘
                  │
          ┌───────┴────────┐
          ▼                ▼
  Java Backend          MySQL 8.0
  Spring Boot 3         Redis 7
  MyBatis · Flyway</pre>
        </div>

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead><tr style="background:#f8fafc"><th style="text-align:left;padding:12px 16px;border-bottom:2px solid #e2e8f0">Layer</th><th style="text-align:left;padding:12px 16px;border-bottom:2px solid #e2e8f0">Technology</th><th style="text-align:left;padding:12px 16px;border-bottom:2px solid #e2e8f0">Purpose</th></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r[0]"><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">{{ r[0] }}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">{{ r[1] }}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b">{{ r[2] }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </PageShell>
</template>
<script lang="ts">
const rows = [
  ['Engine','Vue 3 + Vite + TypeScript','SPA admin panel with visual drag-and-drop designer'],
  ['BFF','Next.js 16 / Node','API aggregation, JWT auth, backend proxy'],
  ['Backend','Spring Boot 3 + MyBatis','RESTful API, Flyway migrations, business logic'],
  ['Database','MySQL 8.0 + Redis 7','Relational storage + caching'],
  ['UI Library','Vue 3 + SCSS + Nx','75+ Material Design components, auto-registered'],
  ['SSR','Nuxt 3 + Nitro','Server-side rendering, SEO, dynamic page routing'],
  ['AI','Python FastAPI + DeepSeek','Natural language page generation, RAG materials'],
];
</script>
