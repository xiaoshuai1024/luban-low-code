#!/usr/bin/env python3
"""Seed all Luban website pages. Every page is a Luban PageSchema — no hand-coded pages."""
import json, urllib.request, sys

BFF = 'http://192.168.100.248:3100'
login_data = json.dumps({'username': 'e2e', 'password': 'e2e@2026'}).encode()
req = urllib.request.Request(f'{BFF}/api/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
token = json.loads(urllib.request.urlopen(req).read())['token']
h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

req = urllib.request.Request(f'{BFF}/api/sites', headers=h)
sites = json.loads(urllib.request.urlopen(req).read())
site = next((s for s in sites if s.get('slug') == 'default'), None)
if not site: print('ERROR: no default site'); sys.exit(1)
site_id = site['id']
print(f'Site: {site_id}')

def publish(name, path, children):
    schema = {'root': {'id': 'root', 'type': 'LubanPage', 'props': {}, 'children': children}}
    data = json.dumps({'name': name, 'path': path, 'status': 'published', 'schema': schema}).encode()
    # Delete existing page first
    pages_req = urllib.request.Request(f'{BFF}/api/sites/{site_id}/pages', headers=h)
    existing = json.loads(urllib.request.urlopen(pages_req).read())
    for p in existing:
        if p['path'] == path:
            print(f'  Deleting {path}...')
            dreq = urllib.request.Request(f'{BFF}/api/sites/{site_id}/pages/{p["id"]}', headers=h, method='DELETE')
            urllib.request.urlopen(dreq)
            break
    req2 = urllib.request.Request(f'{BFF}/api/sites/{site_id}/pages', data=data, headers=h, method='POST')
    try:
        resp = urllib.request.urlopen(req2)
        result = json.loads(resp.read())
        print(f'  OK: {path} -> {result.get("id","?")}')
    except Exception as e:
        print(f'  FAIL: {path} -> {e}')

# ============================================================
# HOMEPAGE — Rich landing page built with Luban components
# ============================================================
publish('Luban Website', '/', [
    # Navigation Bar
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban','links':[
        {'label':'Components','href':'/default/components'},
        {'label':'Docs','href':'/default/docs'},
        {'label':'Examples','href':'/default/examples'},
    ]}},
    # Hero Section
    {'id':'hero','type':'LubanHero','props':{
        'title':'Build Apps at the Speed of Thought',
        'subtitle':'Drag-and-drop visual builder with 75+ Material Design components. Connect to any database, deploy anywhere. The open-source low-code platform for developers who want to ship faster.',
        'primaryCta':'Get Started Free',
        'primaryLink':'/default/docs/getting-started',
        'secondaryCta':'Browse Components',
        'secondaryLink':'/default/components',
    }},
    # Feature Grid — 6 core capabilities
    {'id':'feat','type':'LubanFeatureGrid','props':{'items':[
        {'icon':'1','title':'Visual Builder','desc':'Drag-and-drop interface with real-time preview. No coding required to create beautiful layouts.'},
        {'icon':'2','title':'75+ Components','desc':'Buttons, forms, tables, charts, modals — a complete Material Design component library.'},
        {'icon':'3','title':'SSR Ready','desc':'Nuxt Nitro server-side rendering. SEO-friendly, fast loading, perfect for public sites.'},
        {'icon':'4','title':'AI Powered','desc':'Describe your page in natural language. DeepSeek generates the schema — confirm and publish.'},
        {'icon':'5','title':'Data Driven','desc':'Connect MySQL, PostgreSQL, or REST APIs. Bind data to components with a visual query builder.'},
        {'icon':'6','title':'Multi-Platform','desc':'Build once, render everywhere. Desktop, tablet, mobile — responsive breakpoints built in.'},
    ]}},
    # How it Works — 3 step process
    {'id':'steps','type':'LubanSteps','props':{'items':[
        {'title':'Drag Components','description':'Pick from 75+ components in the palette. Drag onto the canvas. Each component has sensible defaults so you can see results instantly.'},
        {'title':'Configure Properties','description':'Customize styles, bind data, add interactions — all in the right panel. Changes reflect immediately on the canvas.'},
        {'title':'Publish','description':'One click to deploy. Your page runs on our SSR engine — fast, SEO-optimized, and always online.'},
    ],'direction':'horizontal'}},
    # Code Example
    {'id':'code','type':'LubanCodeBlock','props':{
        'code':'{\n  "root": {\n    "type": "LubanContainer",\n    "children": [\n      { "type": "LubanNavbar", "props": { "title": "My Site" } },\n      { "type": "LubanHero", "props": {\n        "title": "Welcome",\n        "subtitle": "Built with Luban"\n      } },\n      { "type": "LubanFeatureGrid", "props": { "items": [...] } },\n      { "type": "LubanFooter", "props": { "copyright": "2026" } }\n    ]\n  }\n}',
        'language':'json',
    }},
    # Stats Row
    {'id':'stats','type':'LubanStats','props':{'items':[
        {'label':'Components','value':'75+'},
        {'label':'Framework','value':'Vue 3'},
        {'label':'License','value':'MIT'},
        {'label':'Rendering','value':'SSR'},
    ]}},
    # CTA Banner
    {'id':'cta','type':'LubanCTA','props':{
        'title':'Ready to build something great?',
        'subtitle':'Start building with Luban today. Free and open-source.',
        'primaryText':'Get Started',
        'primaryLink':'/default/docs/getting-started',
    }},
    # Footer
    {'id':'ftr','type':'LubanFooter','props':{'copyright':'2026 Luban. MIT License.'}},
    # Back to Top
    {'id':'btt','type':'LubanBackToTop','props':{}},
])

# ============================================================
# SUB-PAGES — Built with LubanNavbar + LubanMarkdown + LubanFooter
# ============================================================

def mk_md_page(name, path, md):
    return publish(name, path, [
        {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
        {'id':'md','type':'LubanMarkdown','props':{'content':md,'theme':'github'}},
        {'id':'ftr','type':'LubanFooter','props':{'copyright':'2026 Luban. MIT License.'}},
    ])

mk_md_page('Components','/components',
    '# Component Library\n\nLuban includes **75+ Material Design components** across 8 categories. Every component is auto-registered, customizable, and works across all screen sizes.\n\n'
    '## Categories\n\n'
    '| Category | Components |\n|----------|------------|\n'
    '| Layout | Container, Row, Col, SidePanel |\n'
    '| Form | Input, Select, TextArea, Checkbox, Switch, RadioGroup, Form, DatePicker, DateRange, TimePicker, PhoneInput, Slider, RegionSelect, Rating, TagInput |\n'
    '| Marketing | Hero, CTA, FeatureGrid, Pricing, FAQ, Stats, Testimonial, TestimonialCarousel, Gallery, Navbar, Footer, LogoCloud, LeadCapture, Countdown, Coupon |\n'
    '| Data Display | Table, CodeBlock |\n'
    '| Navigation | Tabs, Menu, BackToTop |\n'
    '| Feedback | Alert, Modal, Drawer, Toast |\n'
    '| Content | Markdown, Steps, Banner, ContentList |\n'
    '| General | Button, Text, Heading, Link, Icon, Image, Card, Video, Divider, RichText |\n\n'
    '## Example\n\n```json\n{\n  "type": "LubanMarkdown",\n  "props": {\n    "content": "# Hello Luban"\n  }\n}\n```\n\n'
    '> All components are Material Design styled. Visit the admin panel (port 4200) to use the visual builder with drag-and-drop support.')

mk_md_page('Documentation','/docs',
    '# Documentation\n\n'
    '## Quick Links\n\n'
    '- [Getting Started](/default/docs/getting-started) — Build your first page\n'
    '- [Architecture](/default/docs/architecture) — System design overview\n'
    '- [API Reference](/default/docs/api) — Public and admin endpoints\n\n'
    '## What is Luban?\n\n'
    'Luban is an **open-source low-code platform** (MIT license) for building modern web applications.\n\n'
    '- Visual drag-and-drop designer\n'
    '- 75+ Material Design components\n'
    '- SSR rendering (Nuxt Nitro)\n'
    '- BFF aggregation layer (Next.js)\n'
    '- Java backend (Spring Boot + MySQL)\n'
    '- AI-powered page generation (DeepSeek)')

mk_md_page('Getting Started','/docs/getting-started',
    '# Getting Started\n\nBuild your first page in under **5 minutes**.\n\n'
    '## Step 1: Create a Site\n\nLog into the admin panel at port **4200**. Go to Sites and click **New Site**.\n\n'
    '## Step 2: Create a Page\n\nEnter your site, go to Pages and click **New Page**.\n\n'
    '## Step 3: Drag Components\n\nBrowse the palette on the left. Drag any component onto the canvas.\n\n'
    '> Ctrl+Z undo, Ctrl+Shift+Z redo.\n\n'
    '## Step 4: Configure\n\nClick any component to open the property panel.\n\n'
    '## Step 5: Publish\n\nHit **Publish** and your page is live with SSR!\n\n'
    '## Example\n\n```json\n{\n  "root": {\n    "type": "LubanContainer",\n    "children": [\n'
    '      { "type": "LubanHeading", "props": { "content": "Hello" } },\n'
    '      { "type": "LubanButton", "props": { "content": "Click", "color": "primary" } }\n'
    '    ]\n  }\n}\n```\n\n'
    'Next: [Architecture](/default/docs/architecture)')

mk_md_page('Architecture','/docs/architecture',
    '# System Architecture\n\n'
    '## Request Flow\n\n```\n'
    'Browser\n'
    '  +-- Engine (SPA)    -- Vue 3 + Vite, Port 4200 (Admin)\n'
    '  +-- Website (SSR)   -- Nuxt 3 + Nitro, Port 4173 (Public)\n'
    '       |\n'
    '       +-- BFF (Next.js 16) -- Port 3100\n'
    '            +-- Java (Spring Boot 3) + MySQL 8.0 + Redis 7\n'
    '            +-- AI (FastAPI + DeepSeek) + PostgreSQL + Qdrant\n'
    '```\n\n'
    '## Tech Stack\n\n'
    '| Layer | Technology |\n|-------|-----------|\n'
    '| Engine | Vue 3 + Vite + TypeScript |\n'
    '| BFF | Next.js 16 |\n'
    '| Backend | Spring Boot 3 + MyBatis + Flyway |\n'
    '| Database | MySQL 8.0 + Redis 7 |\n'
    '| UI Library | Vue 3 + SCSS + Nx (75+ components) |\n'
    '| SSR | Nuxt 3 + Nitro |\n'
    '| AI | Python FastAPI + DeepSeek |')

mk_md_page('API Reference','/docs/api',
    '# API Reference\n\n'
    '## Public (no auth)\n\n'
    '### GET /api/public/sites/:slug/pages/by-path\n\n**Query:** `?path=/page-path`\n\n'
    '```json\n{ "id":"uuid","name":"Page","path":"/path","schema":{...},"seo":{...} }\n```\n\n'
    '### POST /api/forms/:id/submit\n\nSubmit a lead capture form. No authentication.\n\n'
    '## Admin (JWT required)\n\n'
    '| Method | Path | Description |\n|--------|------|-------------|\n'
    '| GET | /api/sites | List |\n| POST | /api/sites | Create |\n'
    '| GET | /api/sites/:id/pages | List |\n| POST | /api/sites/:id/pages | Create |\n'
    '| PUT | /api/sites/:id/pages/:pid | Update |\n| DELETE | /api/sites/:id/pages/:pid | Delete |\n\n'
    '## Errors\n\n'
    '| Code | HTTP |\n|------|:---:|\n'
    '| UNAUTHENTICATED | 401 |\n| PERMISSION_DENIED | 403 |\n'
    '| NOT_FOUND | 404 |\n| INVALID_ARGUMENT | 400 |')

mk_md_page('Examples','/examples',
    '# Examples & Templates\n\nStart with a template and customize to fit your brand.\n\n'
    '| Template | Components Used |\n|----------|----------------|\n'
    '| E-Commerce | Hero, Card, Button, Footer |\n'
    '| Dashboard | Table, Stats, Form, Modal |\n'
    '| Marketing | Hero, FeatureGrid, Pricing, CTA |\n'
    '| Company | Navbar, Hero, Testimonial, Footer |\n\n'
    'Build your own: [Getting Started](/default/docs/getting-started)')

mk_md_page('Open Source','/open-source',
    '# Open Source\n\nLuban is licensed under **MIT**.\n\n'
    '## Repository\n\n```\n'
    'luban-workspace/\n'
    '  apps/       engine/ bff/ website/ backend-java/\n'
    '  packages/   ui/ ai-assistant/\n'
    '  docs/\n'
    '```\n\n'
    '## Stack\n\nVue 3 + Vite + TypeScript | Next.js 16 | Spring Boot 3 | Nuxt 3 | FastAPI | MySQL + Redis\n\n'
    '## Roadmap\n\n'
    '- [x] Visual drag-and-drop designer\n'
    '- [x] 75+ Material Design components\n'
    '- [x] SSR rendering\n'
    '- [x] AI page generation\n'
    '- [ ] Advanced form designer\n'
    '- [ ] i18n support\n'
    '- [ ] Dashboard widgets\n'
    '- [ ] Mobile app generation')

print('\nAll pages created!')
