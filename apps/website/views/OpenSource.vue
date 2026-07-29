<script setup lang="ts">
import PageShell from '~/components/PageShell.vue';
</script>
<template>
  <PageShell title="Open Source — Luban" description="Luban is open-source under MIT license.">
    <section style="padding:80px 0;max-width:800px;margin:0 auto">
      <div class="ps-container">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#22c55e;margin-bottom:12px">Open Source</span>
        <h1 style="font-size:40px;font-weight:800;margin-bottom:8px">Built in the open</h1>
        <p style="font-size:17px;color:#64748b;margin-bottom:40px;line-height:1.7">Luban is licensed under <strong style="color:#22c55e">MIT</strong>. Free to use, modify, and distribute — forever.</p>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:40px">
          <div v-for="s in stats" :key="s.label" style="padding:20px;border-radius:12px;border:1px solid #e2e8f0;text-align:center">
            <div style="font-size:28px;font-weight:800;color:#4f46e5">{{ s.value }}</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px">{{ s.label }}</div>
          </div>
        </div>

        <h2 style="font-size:22px;font-weight:700;margin-bottom:16px">Repository</h2>
        <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:32px;font-family:'Fira Code',monospace;font-size:13px;line-height:1.8;color:#1e293b">
          📁 luban-workspace/<br>
          &nbsp;&nbsp;├── apps/<br>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── engine/&emsp;&emsp;&emsp;&emsp;<span style="color:#64748b"># Low-code Engine (Vue 3 SPA)</span><br>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── bff/&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;<span style="color:#64748b"># BFF (Next.js)</span><br>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── website/&emsp;&emsp;&emsp;&emsp;<span style="color:#64748b"># SSR Site (Nuxt 3)</span><br>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── backend-java/&emsp;&emsp;<span style="color:#64748b"># Backend (Spring Boot)</span><br>
          &nbsp;&nbsp;├── packages/<br>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── ui/&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;<span style="color:#64748b"># 75+ Material Design components</span><br>
          &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── ai-assistant/&emsp;&emsp;<span style="color:#64748b"># AI Assistant (DeepSeek)</span><br>
          &nbsp;&nbsp;└── docs/&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;<span style="color:#64748b"># Architecture docs</span>
        </div>

        <h2 style="font-size:22px;font-weight:700;margin-bottom:16px">Roadmap</h2>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div v-for="r in roadmap" :key="r" style="display:flex;align-items:center;gap:10px;font-size:14px">
            <span :style="{color:r.done?'#22c55e':'#94a3b8',fontWeight:700}">{{ r.done ? '✓' : '○' }}</span>
            <span style="color:var(--c-text)">{{ r.item }}</span>
          </div>
        </div>
      </div>
    </section>
  </PageShell>
</template>
<script lang="ts">
const stats = [{ label:'Components',value:'75+'},{label:'License',value:'MIT'},{label:'Stack',value:'Vue 3 + Java'}];
const roadmap = [
  { done:true,item:'Visual drag-and-drop designer' },{ done:true,item:'75+ Material Design components' },
  { done:true,item:'SSR rendering (Nuxt Nitro)' },{ done:true,item:'AI natural language page generation' },
  { done:true,item:'Spring Boot REST API + Flyway' },{ done:false,item:'Advanced form designer' },
  { done:false,item:'Internationalization (i18n)' },{ done:false,item:'Dashboard analytics widgets' },
  { done:false,item:'Mobile app generation (Flutter/Electron)' },
];
</script>
