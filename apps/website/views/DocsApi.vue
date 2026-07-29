<script setup lang="ts">
import PageShell from '~/components/PageShell.vue';
</script>
<template>
  <PageShell title="API Reference — Luban" description="Luban API documentation.">
    <section style="padding:80px 0;max-width:800px;margin:0 auto">
      <div class="ps-container">
        <span style="display:inline-block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px">Reference</span>
        <h1 style="font-size:40px;font-weight:800;margin-bottom:32px">API Reference</h1>

        <h2 style="font-size:22px;font-weight:700;margin:40px 0 16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0">Public Endpoints</h2>
        <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;background:#22c55e20;color:#22c55e;margin-bottom:12px">GET</span>
          <code style="font-size:15px;font-weight:600">/api/public/sites/:slug/pages/by-path?path=:path</code>
          <p style="font-size:14px;color:#64748b;margin-top:8px">Fetch a published page's schema by site slug and path. Used by the website SSR engine.</p>
        </div>
        <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;background:#f59e0b20;color:#f59e0b;margin-bottom:12px">POST</span>
          <code style="font-size:15px;font-weight:600">/api/forms/:id/submit</code>
          <p style="font-size:14px;color:#64748b;margin-top:8px">Submit a lead capture form. No authentication required. Supports dedup and spam protection.</p>
        </div>

        <h2 style="font-size:22px;font-weight:700;margin:40px 0 16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0">Admin Endpoints (JWT Required)</h2>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f8fafc"><th style="text-align:left;padding:10px 14px;border-bottom:2px solid #e2e8f0">Method</th><th style="text-align:left;padding:10px 14px;border-bottom:2px solid #e2e8f0">Endpoint</th><th style="text-align:left;padding:10px 14px;border-bottom:2px solid #e2e8f0">Description</th></tr></thead>
            <tbody>
              <tr v-for="r in adminEndpoints" :key="r[1]"><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;font-family:monospace;font-size:12px">{{ r[0] }}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:13px">{{ r[1] }}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b">{{ r[2] }}</td></tr>
            </tbody>
          </table>
        </div>

        <h2 style="font-size:22px;font-weight:700;margin:40px 0 16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0">Error Codes</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div v-for="e in errors" :key="e[0]" style="padding:16px;border-radius:8px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:24px;font-weight:800;color:#4f46e5;margin-bottom:4px">{{ e[1] }}</div><div style="font-size:13px;font-weight:600;margin-bottom:4px">{{ e[0] }}</div><div style="font-size:12px;color:#64748b">{{ e[2] }}</div></div>
        </div>
      </div>
    </section>
  </PageShell>
</template>
<script lang="ts">
const adminEndpoints = [
  ['GET','/api/sites','List all sites'],['POST','/api/sites','Create a site'],
  ['GET','/api/sites/:id','Get site detail'],['PUT','/api/sites/:id','Update site'],['DELETE','/api/sites/:id','Delete site'],
  ['GET','/api/sites/:id/pages','List pages'],['POST','/api/sites/:id/pages','Create page'],
  ['PUT','/api/sites/:id/pages/:pid','Update page'],['DELETE','/api/sites/:id/pages/:pid','Delete page'],
  ['GET','/api/leads','List leads'],['GET','/api/users','List users'],['GET','/api/forms','List forms'],
];
const errors = [
  ['UNAUTHENTICATED','401','Invalid or expired JWT'],['PERMISSION_DENIED','403','Insufficient role'],
  ['NOT_FOUND','404','Resource not found'],['INVALID_ARGUMENT','400','Validation error'],
  ['CONFLICT','409','Duplicate resource'],['INTERNAL','500','Server error'],
];
</script>
