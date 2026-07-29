#!/usr/bin/env python3
"""Seed website pages using Luban components (Markdown for content pages)."""
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

def mk_schema(md):
    return {
        'root': {
            'id': 'root', 'type': 'LubanPage', 'props': {},
            'children': [
                {'id': 'nav', 'type': 'LubanNavbar', 'props': {'title': 'Luban'}},
                {'id': 'main', 'type': 'LubanMarkdown', 'props': {'content': md, 'theme': 'github'}},
                {'id': 'ftr', 'type': 'LubanFooter', 'props': {'copyright': '2026 Luban. MIT License.'}},
            ]
        }
    }

def upsert(name, path, md):
    data = json.dumps({'name': name, 'path': path, 'status': 'published', 'schema': mk_schema(md)}).encode()
    try:
        req = urllib.request.Request(f'{BFF}/api/sites/{site_id}/pages', data=data, headers=h, method='POST')
        urllib.request.urlopen(req)
        print(f'  CREATE: {path}')
    except urllib.error.HTTPError as e:
        if e.code == 400:
            print(f'  SKIP: {path} exists')
        else:
            print(f'  FAIL: {path} [{e.code}] {e.read().decode()[:100]}')

upsert('Components', '/components',
    '# Component Library\n\nLuban includes **75+ Material Design components** across 8 categories. Every component is auto-registered, customizable, and works across all screen sizes.\n\n## Categories\n\n| Category | Components |\n|----------|------------|\n| Layout | Container, Row, Col, SidePanel |\n| Form | Input, Select, TextArea, Checkbox, Switch, RadioGroup, Form |\n| Marketing | Hero, CTA, FeatureGrid, Pricing, FAQ, Stats, Testimonial, TestimonialCarousel, Gallery, Navbar, Footer, LogoCloud |\n| Data Display | Table, CodeBlock |\n| Navigation | Tabs, Menu, BackToTop |\n| Feedback | Alert, Modal, Drawer, Toast |\n| Content | Markdown, Steps, Banner, ContentList |\n| General | Button, Text, Heading, Link, Icon, Image, Card |\n\n## Example\n\n```json\n{\n  "type": "LubanMarkdown",\n  "props": {\n    "content": "# Hello Luban"\n  }\n}\n```\n\n> All components are Material Design styled. Visit the admin panel (port 4200) to use the visual builder.')

upsert('Documentation', '/docs',
    '# Documentation\n\nWelcome to Luban documentation.\n\n## Quick Links\n\n- [Getting Started](/default/docs/getting-started) — Build your first page\n- [Architecture](/default/docs/architecture) — System design overview\n- [API Reference](/default/docs/api) — Public and admin endpoints\n\nLuban is an **open-source low-code platform** (MIT license) for building modern web applications with a visual drag-and-drop designer, 75+ Material Design components, SSR rendering, and AI-powered page generation.')

upsert('Getting Started', '/docs/getting-started',
    '# Getting Started\n\nBuild your first page in under **5 minutes**.\n\n## Step 1: Create a Site\n\nLog into the admin panel at port **4200**. Go to Sites and click **New Site**.\n\n## Step 2: Create a Page\n\nEnter your site, go to Pages and click **New Page**.\n\n## Step 3: Drag Components\n\nBrowse the component palette on the left. Drag any component onto the canvas.\n\n> Ctrl+Z to undo, Ctrl+Shift+Z to redo.\n\n## Step 4: Configure\n\nClick any component to open the property panel.\n\n## Step 5: Publish\n\nHit **Publish** and your page is live with SSR!\n\n## Example Schema\n\n```json\n{\n  "root": {\n    "type": "LubanContainer",\n    "children": [\n      { "type": "LubanHeading", "props": { "content": "Hello" } },\n      { "type": "LubanButton", "props": { "content": "Click", "color": "primary" } }\n    ]\n  }\n}\n```\n\nNext: [System Architecture](/default/docs/architecture)')

upsert('Architecture', '/docs/architecture',
    '# System Architecture\n\n```\nBrowser\n  +-- Engine (SPA)    -- Vue 3 + Vite, Port 4200\n  +-- Website (SSR)   -- Nuxt 3 + Nitro, Port 4173\n       |\n       +-- BFF (Next.js 16) -- Port 3100\n            +-- Java (Spring Boot 3) + MySQL 8.0 + Redis 7\n            +-- AI (FastAPI + DeepSeek) + Qdrant\n```\n\n## Tech Stack\n\n| Layer | Technology |\n|-------|-----------|\n| Engine | Vue 3 + Vite + TypeScript |\n| BFF | Next.js 16 |\n| Backend | Spring Boot 3 + MyBatis + Flyway |\n| DB | MySQL 8.0 + Redis 7 |\n| UI | Vue 3 + SCSS + Nx |\n| SSR | Nuxt 3 + Nitro |\n| AI | Python FastAPI + DeepSeek |')

upsert('API Reference', '/docs/api',
    '# API Reference\n\n## Public (no auth)\n\n### GET /api/public/sites/:slug/pages/by-path\n\n**Query:** `?path=/page-path`\n\n**Response:**\n```json\n{ "id": "uuid", "name": "Page", "path": "/path", "schema": {...}, "seo": {...} }\n```\n\n### POST /api/forms/:id/submit\n\nSubmit a lead. No auth.\n\n## Admin (JWT required)\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | /api/sites | List |\n| POST | /api/sites | Create |\n| GET | /api/sites/:id/pages | List |\n| POST | /api/sites/:id/pages | Create |\n| PUT | /api/sites/:id/pages/:pid | Update |\n| DELETE | /api/sites/:id/pages/:pid | Delete |\n\n## Errors\n\n| Code | HTTP |\n|------|:---:|\n| UNAUTHENTICATED | 401 |\n| PERMISSION_DENIED | 403 |\n| NOT_FOUND | 404 |')

upsert('Examples', '/examples',
    '# Examples & Templates\n\nStart with a template and customize.\n\n| Template | Components |\n|----------|-----------|\n| E-Commerce | Hero, Card, Button, Footer |\n| Dashboard | Table, Stats, Form, Modal |\n| Marketing | Hero, FeatureGrid, Pricing, CTA |\n| Company | Navbar, Hero, Testimonial, Footer |\n\nBuild your own: [Getting Started](/default/docs/getting-started)')

upsert('Open Source', '/open-source',
    '# Open Source\n\nLuban is licensed under **MIT**.\n\n## Repository\n\n```\nluban-workspace/\n  apps/       engine/ bff/ website/ backend-java/\n  packages/   ui/ ai-assistant/\n  docs/\n```\n\n## Stack\n\nVue 3 + Vite + TypeScript | Next.js 16 | Spring Boot 3 | Nuxt 3 | Python FastAPI | MySQL + Redis\n\n## Roadmap\n\n- [x] Visual drag-and-drop designer\n- [x] 75+ Material Design components\n- [x] SSR rendering\n- [x] AI page generation\n- [ ] Advanced form designer\n- [ ] i18n support\n- [ ] Dashboard widgets')

print('\nDone!')
