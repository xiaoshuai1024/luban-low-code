<script setup lang="ts">
import PageShell from '~/components/PageShell.vue';
</script>
<template>
  <PageShell title="Getting Started — Luban" description="Build your first page with Luban.">
    <section style="padding:80px 0;max-width:800px;margin:0 auto">
      <div class="ps-container">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Guide</span>
        <h1 style="font-size:40px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px">Getting Started</h1>
        <p style="font-size:17px;color:#64748b;margin-bottom:48px;line-height:1.7">Build your first page in under 5 minutes.</p>

        <div v-for="s in steps" :key="s.num" style="display:flex;gap:20px;margin-bottom:40px">
          <div style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px">{{ s.num }}</div>
          <div>
            <h3 style="font-weight:700;font-size:18px;margin-bottom:6px">{{ s.title }}</h3>
            <p style="font-size:15px;color:#64748b;line-height:1.8">{{ s.desc }}</p>
          </div>
        </div>

        <div style="background:#f8fafc;border-radius:12px;padding:32px;margin-top:48px">
          <h3 style="font-weight:700;margin-bottom:16px">Example Schema</h3>
          <pre style="background:#0f172a;color:#e2e8f0;padding:20px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.7;font-family:'Fira Code',monospace"><span style="color:#93c5fd">"root"</span>: {
  <span style="color:#93c5fd">"type"</span>: <span style="color:#86efac">"LubanContainer"</span>,
  <span style="color:#93c5fd">"children"</span>: [
    { <span style="color:#93c5fd">"type"</span>: <span style="color:#86efac">"LubanHeading"</span>, <span style="color:#93c5fd">"props"</span>: { <span style="color:#93c5fd">"content"</span>: <span style="color:#86efac">"Hello"</span> } },
    { <span style="color:#93c5fd">"type"</span>: <span style="color:#86efac">"LubanButton"</span>, <span style="color:#93c5fd">"props"</span>: { <span style="color:#93c5fd">"content"</span>: <span style="color:#86efac">"Click"</span> } }
  ]
}</pre>
        </div>
      </div>
    </section>
  </PageShell>
</template>
<script lang="ts">
const steps = [
  { num:1,title:'Create a Site',desc:'Log into the admin panel at port 4200. Navigate to "Sites" and click "New Site". Give it a name and a unique slug.' },
  { num:2,title:'Create a Page',desc:'Enter your site, go to "Pages" and click "New Page". Choose a template or start with a blank canvas.' },
  { num:3,title:'Drag Components',desc:'Browse the component palette on the left. Drag any component onto the canvas — buttons, forms, tables, and 70+ more.' },
  { num:4,title:'Configure Properties',desc:'Click any component to open the property panel. Change styles, bind data sources, add events and interactions.' },
  { num:5,title:'Publish',desc:'Hit "Publish" and your page is live! The SSR engine renders it with full SEO support on the website domain.' },
];
</script>
