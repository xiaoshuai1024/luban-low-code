<script setup lang="ts">
useHead({ title: 'Luban — Open-Source Low-Code Platform' });
</script>

<template>
  <div class="luban-home">
    <!-- Nav -->
    <nav class="nav">
      <div class="container">
        <a href="/" class="nav-logo">Luban</a>
        <div class="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it Works</a>
          <a href="/default/components">Components</a>
          <a href="/default/docs">Docs</a>
          <a href="/default/examples">Examples</a>
          <a href="https://github.com" target="_blank">GitHub</a>
          <a href="#" class="nav-cta">Get Started</a>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="section hero">
      <div class="container">
        <div class="hero-badge"><span class="hero-badge-dot" /> v1.0 Now Available — Open Source</div>
        <h1 class="section-title">Build Apps at the Speed<br />of Thought</h1>
        <p class="hero-subtitle">Drag-and-drop visual builder with 75+ Material Design components. Connect to any database, deploy anywhere. The open-source low-code platform for developers who want to ship faster.</p>
        <div class="hero-actions">
          <a href="/default/docs/getting-started" class="btn btn-primary btn-lg">Get Started Free &rarr;</a>
          <a href="/default/components" class="btn btn-outline btn-lg">Browse Components</a>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="hero-stat-num">75+</div><div class="hero-stat-label">Components</div></div>
          <div class="hero-stat"><div class="hero-stat-num">Vue 3</div><div class="hero-stat-label">Framework</div></div>
          <div class="hero-stat"><div class="hero-stat-num">MIT</div><div class="hero-stat-label">License</div></div>
          <div class="hero-stat"><div class="hero-stat-num">SSR</div><div class="hero-stat-label">Rendering</div></div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="section page-section">
      <div class="container section-center">
        <span class="section-label">Platform</span>
        <h2 class="section-title heading">Everything you need to build<br />modern web applications</h2>
        <p class="section-desc">From simple landing pages to complex dashboards — all powered by a unified visual builder.</p>
        <div class="features-grid">
          <div class="feature-card"><div class="feature-icon purple">&#x1F3A8;</div><h3>Visual Builder</h3><p>Drag-and-drop interface with real-time preview. No coding required to create beautiful layouts.</p></div>
          <div class="feature-card"><div class="feature-icon cyan">&#x1F4DA;</div><h3>75+ Components</h3><p>Buttons, forms, tables, charts, modals — a complete Material Design component library.</p></div>
          <div class="feature-card"><div class="feature-icon amber">&#x26A1;</div><h3>SSR Ready</h3><p>Nuxt Nitro server-side rendering. SEO-friendly, fast loading, perfect for public sites.</p></div>
          <div class="feature-card"><div class="feature-icon green">&#x1F916;</div><h3>AI Powered</h3><p>Describe your page in natural language. DeepSeek generates the schema — confirm and publish.</p></div>
          <div class="feature-card"><div class="feature-icon rose">&#x1F4CA;</div><h3>Data Driven</h3><p>Connect MySQL, PostgreSQL, or REST APIs. Bind data to components with a visual query builder.</p></div>
          <div class="feature-card"><div class="feature-icon blue">&#x1F310;</div><h3>Multi-Platform</h3><p>Build once, render everywhere. Desktop, tablet, mobile — responsive breakpoints built in.</p></div>
        </div>
      </div>
    </section>

    <!-- How it Works -->
    <section id="how" class="section page-section alt">
      <div class="container">
        <div class="two-col">
          <div>
            <span class="section-label">How it Works</span>
            <h2 class="section-title heading">From idea to live page<br />in three steps</h2>
            <p class="section-desc text-muted">No build tools, no deployment pipelines — everything happens in the browser.</p>
            <div class="steps-vertical">
              <div class="step-row"><div class="step-num">1</div><div><h3>Drag Components</h3><p>Pick from 75+ components in the palette. Drag onto the canvas. Each component has sensible defaults so you can see results instantly.</p></div></div>
              <div class="step-row"><div class="step-num">2</div><div><h3>Configure Properties</h3><p>Customize styles, bind data, add interactions — all in the right panel. Changes reflect immediately on the canvas.</p></div></div>
              <div class="step-row"><div class="step-num">3</div><div><h3>Publish</h3><p>One click to deploy. Your page runs on our SSR engine — fast, SEO-optimized, and always online.</p></div></div>
            </div>
          </div>
          <div class="code-show">
            <div class="code-show-header"><span class="code-show-dot red" /><span class="code-show-dot yellow" /><span class="code-show-dot green" /></div>
            <pre><span class="code-key">"root"</span>: {
  <span class="code-key">"type"</span>: <span class="code-str">"LubanContainer"</span>,
  <span class="code-key">"children"</span>: [
    { <span class="code-key">"type"</span>: <span class="code-str">"LubanNavbar"</span>, <span class="code-key">"props"</span>: { <span class="code-key">"title"</span>: <span class="code-str">"My Site"</span> } },
    { <span class="code-key">"type"</span>: <span class="code-str">"LubanHero"</span>, <span class="code-key">"props"</span>: { <span class="code-key">"title"</span>: <span class="code-str">"Welcome"</span> } },
    { <span class="code-key">"type"</span>: <span class="code-str">"LubanFeatureGrid"</span>, <span class="code-key">"props"</span>: { <span class="code-key">"items"</span>: [...] } },
    { <span class="code-key">"type"</span>: <span class="code-str">"LubanFooter"</span>, <span class="code-key">"props"</span>: { <span class="code-key">"copyright"</span>: <span class="code-str">"2026"</span> } }
  ]
}</pre>
          </div>
        </div>
      </div>
    </section>

    <!-- Components -->
    <section id="components" class="section page-section">
      <div class="container section-center">
        <span class="section-label">Component Library</span>
        <h2 class="section-title heading">75+ production-ready<br />Material Design components</h2>
        <p class="section-desc">Every component is self-contained, customizable, and works across all screen sizes.</p>
        <div class="comp-grid">
          <span class="comp-item">&#x1F9ED; Navbar</span><span class="comp-item">&#x1F9B8; Hero</span><span class="comp-item">&#x1F3AF; CTA</span><span class="comp-item">&#x1F4CA; Stats</span>
          <span class="comp-item">&#x1F4CB; Table</span><span class="comp-item">&#x1F4DD; Form</span><span class="comp-item">&#x270F;&#xFE0F; Input</span><span class="comp-item">&#x2705; Select</span>
          <span class="comp-item">&#x2B1C; Button</span><span class="comp-item">&#x1F4C4; Card</span><span class="comp-item">&#x1F5BC; Image</span><span class="comp-item">&#x1F517; Link</span>
          <span class="comp-item">&#x1F4D1; Tabs</span><span class="comp-item">&#x1F4D0; Row/Col</span><span class="comp-item">&#x1F9E9; Container</span><span class="comp-item">&#x1F514; Modal</span>
          <span class="comp-item">&#x1F4CC; Drawer</span><span class="comp-item">&#x1F4AC; Toast</span><span class="comp-item">&#x26A0;&#xFE0F; Alert</span><span class="comp-item">&#x2753; FAQ</span>
          <span class="comp-item">&#x2B50; Rating</span><span class="comp-item">&#x1F504; Carousel</span><span class="comp-item">&#x1F4C8; Gallery</span><span class="comp-item">&#x1F4B3; Pricing</span>
          <span class="comp-item">&#x1F4DD; Markdown</span><span class="comp-item">&#x1F4BB; CodeBlock</span><span class="comp-item">&#x1FABC; Steps</span><span class="comp-item">&#x2B06; BackToTop</span>
          <span class="comp-item">&#x1F522; Countdown</span><span class="comp-item">&#x1F3AB; Coupon</span><span class="comp-item">&#x1F3F7; Tag</span><span class="comp-item">&#x2194; Divider</span>
        </div>
      </div>
    </section>

    <!-- Templates -->
    <section id="templates" class="section page-section dark">
      <div class="container section-center">
        <span class="section-label" style="color:#818cf8">Use Cases</span>
        <h2 class="section-title heading" style="color:#fff">Templates for every need</h2>
        <p class="section-desc" style="color:rgba(255,255,255,.6)">Start with a template and customize to fit your brand. All templates are built with Luban components.</p>
        <div class="template-cards">
          <div class="template-card"><div class="template-card-icon">&#x1F3EA;</div><h3>E-Commerce</h3><p>Product grids, shopping cart, checkout flow, order tracking — all built with native components.</p></div>
          <div class="template-card"><div class="template-card-icon">&#x1F4CA;</div><h3>Admin Dashboard</h3><p>Data tables, charts, form CRUD, user management — everything an internal tool needs.</p></div>
          <div class="template-card"><div class="template-card-icon">&#x1F4E2;</div><h3>Marketing Site</h3><p>Hero banners, feature grids, pricing tables, testimonials — launch your product site in minutes.</p></div>
        </div>
        <a href="/default/examples" class="btn btn-outline" style="margin-top:40px;display:inline-flex;border-color:rgba(255,255,255,.2);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">View all templates &rarr;</a>
      </div>
    </section>

    <!-- Testimonials -->
    <section id="testimonials" class="section page-section">
      <div class="container section-center">
        <span class="section-label">Testimonials</span>
        <h2 class="section-title heading">Trusted by developers<br />worldwide</h2>
        <div class="testimonial-grid">
          <div class="quote"><p>"Switched from hand-coding to Luban for our internal tools. The visual builder saved us weeks of development time."</p><div class="quote-author"><div class="quote-avatar">Z</div><div><div class="quote-name">Zhang Wei</div><div class="quote-role">Full-stack Developer</div></div></div></div>
          <div class="quote"><p>"The AI page generation is surprisingly good. I described a dashboard in plain text and got a working prototype in seconds."</p><div class="quote-author"><div class="quote-avatar">L</div><div><div class="quote-name">Li Ming</div><div class="quote-role">Product Manager</div></div></div></div>
          <div class="quote"><p>"Having 75+ Material Design components ready to use is a huge time saver. The SSR engine is fast and reliable."</p><div class="quote-author"><div class="quote-avatar">W</div><div><div class="quote-name">Wang Fang</div><div class="quote-role">Tech Lead</div></div></div></div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="section page-section">
      <div class="container section-center">
        <div class="cta-box">
          <h2>Ready to build something great?</h2>
          <p style="opacity:.85;max-width:500px;margin:0 auto 32px;font-size:17px">Start building with Luban today. It's free, open-source, and takes less than 2 minutes to get started.</p>
          <div class="cta-buttons">
            <a href="/default/docs/getting-started" class="btn btn-cta-primary">Get Started Free &rarr;</a>
            <a href="https://github.com" class="btn btn-cta-outline">View on GitHub</a>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div><h3 class="footer-logo">Luban</h3><p class="footer-desc">Open-source low-code platform. Build web apps visually with 75+ Material Design components. Vue 3 + Spring Boot + MIT.</p></div>
          <div><h4>Product</h4><a href="#features">Features</a><a href="#components">Components</a><a href="#templates">Templates</a><a href="/default/docs/api">API</a></div>
          <div><h4>Resources</h4><a href="/default/docs">Docs</a><a href="/default/docs/getting-started">Getting Started</a><a href="/default/docs/architecture">Architecture</a><a href="/default/examples">Examples</a></div>
          <div><h4>Community</h4><a href="/default/open-source">Open Source</a><a href="https://github.com">GitHub</a><a href="/default/open-source">Roadmap</a></div>
          <div><h4>Legal</h4><a href="/default/open-source">MIT License</a></div>
        </div>
        <div class="footer-bottom"><span>&copy; 2026 Luban. Built with Luban.</span><span>Made with &#x2764; for developers</span></div>
      </div>
    </footer>
  </div>
</template>

<style>
/* === All styles derived from prototype === */
.luban-home {
  &, * { box-sizing: border-box; margin: 0; padding: 0; }
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1e293b; background: #fff; line-height: 1.6;
}
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 100px 0; }
.page-section { &.alt { background: #f8fafc; } &.dark { background: #0f172a; color: #f1f5f9; h2, h3 { color: #fff; } p { color: rgba(255,255,255,.6); } } }
.section-center { text-align: center; }
.section-label { display: inline-block; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #4f46e5; margin-bottom: 12px; }
.section-title { font-size: 56px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.15; margin-bottom: 20px;
  &.heading { font-size: 36px; letter-spacing: -.5px; line-height: 1.25; margin-bottom: 16px; }
}
.section-desc { font-size: 17px; color: #64748b; max-width: 600px; margin: 0 auto; line-height: 1.7; }

/* Nav */
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(255,255,255,.85); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0;
  .container { display: flex; align-items: center; justify-content: space-between; height: 64px; }
}
.nav-logo { font-size: 22px; font-weight: 800; color: #4f46e5; text-decoration: none; letter-spacing: -.5px; }
.nav-links { display: flex; gap: 32px; align-items: center;
  a { font-size: 14px; font-weight: 500; color: #64748b; text-decoration: none; transition: color .15s; &:hover { color: #1e293b; } }
}
.nav-cta { padding: 8px 20px; border-radius: 8px; background: #4f46e5; color: #fff !important; font-weight: 600; &:hover { background: #4338ca !important; color: #fff !important; } }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; transition: all .15s; cursor: pointer;
  &.btn-primary { background: #4f46e5; color: #fff; border: none; &:hover { background: #4338ca; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,.3); } }
  &.btn-outline { background: transparent; border: 1.5px solid #e2e8f0; color: #1e293b; &:hover { border-color: #4f46e5; color: #4f46e5; } }
  &.btn-lg { padding: 14px 32px; font-size: 16px; border-radius: 10px; }
}

/* Hero */
.hero { padding: 160px 0 100px; text-align: center; position: relative; overflow: hidden;
  &::before { content: ''; position: absolute; top: -50%; left: -20%; width: 140%; height: 200%; background: radial-gradient(ellipse at 50% 0%, rgba(79,70,229,.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(6,182,212,.06) 0%, transparent 40%); pointer-events: none; }
  .section-title { background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
}
.hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 100px; background: rgba(79,70,229,.08); color: #4f46e5; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
.hero-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; animation: heroPulse 2s infinite; display: inline-block; }
@keyframes heroPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.3); } }
.hero-subtitle { font-size: 18px; color: #64748b; max-width: 640px; margin: 0 auto 40px; line-height: 1.7; }
.hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.hero-stats { display: flex; gap: 48px; justify-content: center; margin-top: 64px; flex-wrap: wrap; }
.hero-stat { text-align: center; }
.hero-stat-num { font-size: 32px; font-weight: 700; }
.hero-stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }

/* Features Grid */
.features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 48px; }
.feature-card { padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; text-align: left; transition: all .2s;
  &:hover { border-color: #818cf8; box-shadow: 0 10px 15px -3px rgba(0,0,0,.06); transform: translateY(-2px); }
  h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
  p { font-size: 14px; color: #64748b; line-height: 1.6; }
}
.feature-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 20px;
  &.purple { background: #eef2ff; color: #4f46e5; } &.cyan { background: #ecfeff; color: #06b6d4; }
  &.amber { background: #fffbeb; color: #d97706; } &.green { background: #ecfdf5; color: #059669; }
  &.rose { background: #fff1f2; color: #e11d48; } &.blue { background: #eff6ff; color: #2563eb; }
}

/* Two Column */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
.text-muted { color: #64748b; }

/* Steps Vertical */
.steps-vertical { display: flex; flex-direction: column; gap: 24px; }
.step-row { display: flex; gap: 16px; align-items: flex-start;
  h3 { font-weight: 700; margin-bottom: 4px; font-size: 16px; }
  p { font-size: 14px; color: #64748b; }
}
.step-num { flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }

/* Code Block */
.code-show { background: #0f172a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,.06); font-size: 13px; line-height: 1.7;
  pre { padding: 24px; margin: 0; overflow-x: auto; font-family: 'JetBrains Mono','Fira Code','Consolas',monospace; color: #e2e8f0; }
}
.code-show-header { display: flex; gap: 8px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,.08); }
.code-show-dot { width: 12px; height: 12px; border-radius: 50%; &.red { background: #ef4444; } &.yellow { background: #eab308; } &.green { background: #22c55e; } }
.code-key { color: #93c5fd; } .code-str { color: #86efac; }

/* Component Grid */
.comp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 48px; }
.comp-item { padding: 14px 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 500; transition: all .15s; cursor: default; display: inline-block;
  &:hover { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }
}

/* Template Cards */
.template-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 48px; }
.template-card { padding: 32px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); text-align: left; transition: .2s;
  &:hover { background: rgba(255,255,255,.1); }
  h3 { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 8px; }
  p { font-size: 14px; color: rgba(255,255,255,.5); line-height: 1.6; }
}
.template-card-icon { font-size: 32px; margin-bottom: 16px; }

/* Testimonials */
.testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 48px; }
.quote { padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: left;
  p { font-size: 14px; color: #64748b; line-height: 1.7; font-style: italic; }
}
.quote-author { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
.quote-avatar { width: 36px; height: 36px; border-radius: 50%; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; }
.quote-name { font-size: 14px; font-weight: 600; }
.quote-role { font-size: 12px; color: #64748b; }

/* CTA Box */
.cta-box { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); border-radius: 24px; padding: 64px; color: #fff;
  h2 { font-size: 36px; font-weight: 800; margin-bottom: 16px; }
}
.cta-buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.btn-cta-primary { background: #fff; color: #4f46e5; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all .15s;
  &:hover { background: #f1f5f9; }
}
.btn-cta-outline { background: transparent; border: 1.5px solid rgba(255,255,255,.3); color: #fff; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all .15s;
  &:hover { background: rgba(255,255,255,.1); border-color: #fff; }
}

/* Footer */
.footer { background: #0f172a; color: #f1f5f9; padding: 64px 0 32px; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 48px;
  h4 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; color: rgba(255,255,255,.5); }
  a { display: block; font-size: 14px; color: rgba(255,255,255,.7); margin-bottom: 10px; text-decoration: none; transition: color .15s; &:hover { color: #fff; } }
}
.footer-logo { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 12px; }
.footer-desc { font-size: 14px; color: rgba(255,255,255,.5); line-height: 1.7; }
.footer-bottom { margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,.08); font-size: 13px; color: rgba(255,255,255,.4); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }

/* Responsive */
@media (max-width: 768px) {
  .hero .section-title { font-size: 36px !important; }
  .features-grid, .two-col, .comp-grid, .template-cards, .testimonial-grid, .footer-grid { grid-template-columns: 1fr !important; }
  .nav-links { display: none; }
  .hero-stats { gap: 24px; }
}
</style>
