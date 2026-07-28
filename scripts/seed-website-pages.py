#!/usr/bin/env python3
"""Seed website landing pages via BFF API."""
import json, urllib.request, sys

BFF = 'http://192.168.100.248:3100'

# Login
login_data = json.dumps({'username': 'e2e', 'password': 'e2e@2026'}).encode()
req = urllib.request.Request(f'{BFF}/api/auth/login', data=login_data,
    headers={'Content-Type': 'application/json'})
token = json.loads(urllib.request.urlopen(req).read())['token']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Get site with slug 'default' (website SSR uses this slug)
req = urllib.request.Request(f'{BFF}/api/sites', headers=headers)
sites = json.loads(urllib.request.urlopen(req).read())
default_site = next((s for s in sites if s.get('slug') == 'default'), None)
if not default_site:
    print('ERROR: no site with slug "default" found')
    sys.exit(1)
site_id = default_site['id']
print(f'Site: {site_id} (slug=default)')

def create_page(name, path, children, status='draft'):
    schema = {'root': {'id': 'root', 'type': 'LubanPage', 'props': {}, 'children': children}}
    data = json.dumps({'name': name, 'path': path, 'status': status, 'schema': schema}).encode()
    req = urllib.request.Request(f'{BFF}/api/sites/{site_id}/pages', data=data,
        headers=headers, method='POST')
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print(f'  OK: {path} -> {result.get("id","?")}')
        return result.get('id')
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  FAIL: {path} [{e.code}]: {body[:200]}')
        return None

# 1. Home
create_page('Luban Home', '/', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban','links':[{'label':'Components','href':'/components'},{'label':'Docs','href':'/docs'},{'label':'Examples','href':'/examples'}]}},
    {'id':'hero','type':'LubanHero','props':{'title':'Luban - Low-Code Platform','subtitle':'Drag, configure, publish. 71+ built-in Material Design components. Vue3 + Spring Boot, fully open-source.','primaryCta':'Get Started','primaryLink':'/docs/getting-started'}},
    {'id':'feats','type':'LubanFeatureGrid','props':{'items':[
        {'icon':'1','title':'Visual Builder','desc':'Drag components onto the canvas, WYSIWYG'},
        {'icon':'2','title':'Material Design','desc':'70+ Material Design components'},
        {'icon':'3','title':'Responsive','desc':'Desktop/tablet/mobile breakpoints'},
        {'icon':'4','title':'SSR Ready','desc':'Nuxt Nitro server-side rendering, SEO friendly'},
        {'icon':'5','title':'AI Powered','desc':'Generate pages with natural language via DeepSeek'},
        {'icon':'6','title':'API Driven','desc':'BFF aggregation layer + Java backend, RESTful'},
    ]}},
    {'id':'steps','type':'LubanSteps','props':{'items':[
        {'title':'Drag Components','description':'Drag from the palette to the canvas'},
        {'title':'Configure Props','description':'Adjust styles, data, and interactions'},
        {'title':'Publish','description':'One click to deploy, SSR rendering'},
    ]}},
    {'id':'stats','type':'LubanStats','props':{'items':[
        {'label':'Components','value':'71+'},
        {'label':'Framework','value':'Vue 3 + Vite'},
        {'label':'Backend','value':'Spring Boot'},
        {'label':'License','value':'MIT'},
    ]}},
    {'id':'cta','type':'LubanCTA','props':{'title':'Start building with Luban','primaryText':'Get Started','primaryLink':'/docs/getting-started'}},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban. All rights reserved.'}},
])

# 2. Components
create_page('Components', '/components', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
    {'id':'title','type':'LubanHeading','props':{'content':'Component Library','tag':'h1'}},
    {'id':'desc','type':'LubanMarkdown','props':{'content':('Luban ships with **71+ Material Design components** across categories: layout, form, marketing, data display, navigation, and feedback.\n\n'
        '## Categories\n\n'
        '| Category | Components |\n'
        '|----------|------------|\n'
        '| Layout | Container, Row, Col, SidePanel |\n'
        '| Form | Input, Select, TextArea, Checkbox, Switch, Form |\n'
        '| Marketing | Hero, CTA, FeatureGrid, Pricing, FAQ, Stats, Testimonial |\n'
        '| Data Display | Table, CodeBlock |\n'
        '| Navigation | Navbar, Tabs, Menu, BackToTop |\n'
        '| Feedback | Alert, Modal, Drawer, Toast |\n'
        '| Content | Markdown, Steps, Banner, ContentList |\n'
        '| General | Button, Text, Heading, Link, Icon, Image |\n')}},
    {'id':'code','type':'LubanCodeBlock','props':{'code':'{\n  "type": "LubanMarkdown",\n  "props": {\n    "content": "# Hello World"\n  }\n}','language':'json'}},
    {'id':'alert','type':'LubanAlert','props':{'type':'info','title':'Tip','content':'All components are auto-registered in the Material Registry. Add yours in materials/index.ts.'}},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban'}},
])

# 3-5 Docs
create_page('Documentation', '/docs', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
    {'id':'title','type':'LubanHeading','props':{'content':'Documentation','tag':'h1'}},
    {'id':'cards','type':'LubanRow','props':{},'children':[
        {'id':'c1','type':'LubanCol','props':{'span':6},'children':[
            {'id':'cc1','type':'LubanCard','props':{'title':'Getting Started','description':'Build your first page from scratch','link':'/docs/getting-started'}}
        ]},
        {'id':'c2','type':'LubanCol','props':{'span':6},'children':[
            {'id':'cc2','type':'LubanCard','props':{'title':'Architecture','description':'Engine -> BFF -> Backend full chain','link':'/docs/architecture'}}
        ]},
        {'id':'c3','type':'LubanCol','props':{'span':6},'children':[
            {'id':'cc3','type':'LubanCard','props':{'title':'API Reference','description':'Public and admin API endpoints','link':'/docs/api'}}
        ]},
        {'id':'c4','type':'LubanCol','props':{'span':6},'children':[
            {'id':'cc4','type':'LubanCard','props':{'title':'Component Dev','description':'How to build custom materials','link':'/docs/components'}}
        ]},
    ]},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban'}},
])

create_page('Getting Started', '/docs/getting-started', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
    {'id':'md','type':'LubanMarkdown','props':{'content':(
        '# Getting Started\n\n'
        '## Step 1: Create a Site\n\n'
        'Log into the admin panel, go to "Sites", click "New Site".\n\n'
        '## Step 2: Create a Page\n\n'
        'Enter the site, click "Pages" -> "New Page". Choose a template or start blank.\n\n'
        '## Step 3: Drag Components\n\n'
        'Select components from the palette on the left and drag them onto the canvas.\n\n'
        '> **Tip:** Ctrl+Z to undo, Ctrl+Shift+Z to redo.\n\n'
        '## Step 4: Configure Props\n\n'
        'Select a component and modify styles, content, and interactions in the right panel.\n\n'
        '## Step 5: Publish\n\n'
        'Click "Publish" to deploy to the website with SSR rendering.\n\n'
        '## Example Schema\n\n'
        '```json\n{\n  "root": {\n    "type": "LubanContainer",\n    "children": [\n'
        '      { "type": "LubanHeading", "props": { "content": "Hello World" } },\n'
        '      { "type": "LubanButton", "props": { "content": "Click Me", "color": "primary" } }\n'
        '    ]\n  }\n}\n```\n\n'
        'Next: [System Architecture](/docs/architecture)\n'
    )}},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban'}},
])

create_page('Architecture', '/docs/architecture', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
    {'id':'md','type':'LubanMarkdown','props':{'content':(
        '# System Architecture\n\n'
        '## Overview\n\n'
        '```\n'
        'Browser -> Engine(SPA) + Website(SSR)\n'
        '               |\n'
        '            BFF (Next.js / Node)\n'
        '               |\n'
        '          Java (Spring Boot) + MySQL + Redis\n'
        '```\n\n'
        '## Tech Stack\n\n'
        '| Layer | Technology |\n'
        '|-------|-----------|\n'
        '| Engine | Vue 3 + Vite + TypeScript |\n'
        '| BFF | Next.js 16 |\n'
        '| Backend | Spring Boot 3 + MyBatis + Flyway |\n'
        '| Database | MySQL 8.0 + Redis 7 |\n'
        '| UI Library | Vue 3 + SCSS + Nx |\n'
        '| SSR | Nuxt 3 + Nitro |\n\n'
        '## Request Flow\n\n'
        '1. Browser -> website Nitro SSR\n'
        '2. Nitro -> BFF GET /api/public/sites/:slug/pages/by-path\n'
        '3. BFF -> Java /backend/public/pages\n'
        '4. Java -> MySQL -> returns PageSchema JSON\n'
        '5. Nitro LubanPage renders -> HTML\n'
    )}},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban'}},
])

create_page('API Reference', '/docs/api', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
    {'id':'md','type':'LubanMarkdown','props':{'content':(
        '# API Reference\n\n'
        '## Public Endpoints\n\n'
        '### GET /api/public/sites/:slug/pages/by-path\n\n'
        '**Query:** `?path=/page-path`\n\n'
        '**Response:**\n\n'
        '```json\n{\n  "id": "uuid",\n  "name": "Page Name",\n'
        '  "path": "/path",\n'
        '  "schema": { "root": { "type": "LubanContainer", "children": [] } },\n'
        '  "seo": { "title": "...", "description": "..." }\n}\n```\n\n'
        '## Admin Endpoints (JWT required)\n\n'
        '| Method | Path | Description |\n'
        '|--------|------|-------------|\n'
        '| GET | /api/sites | List sites |\n'
        '| POST | /api/sites | Create site |\n'
        '| GET | /api/sites/:id/pages | List pages |\n'
        '| POST | /api/sites/:id/pages | Create page |\n'
        '| PUT | /api/sites/:id/pages/:pid | Update page |\n'
        '| DELETE | /api/sites/:id/pages/:pid | Delete page |\n'
        '| GET | /api/leads | List leads |\n'
        '| GET | /api/users | List users |\n\n'
        '## Error Codes\n\n'
        '| Code | HTTP | Description |\n'
        '|------|:---:|-------------|\n'
        '| UNAUTHENTICATED | 401 | Invalid JWT |\n'
        '| PERMISSION_DENIED | 403 | Insufficient permissions |\n'
        '| NOT_FOUND | 404 | Resource not found |\n'
    )}},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban'}},
])

# 6. Examples
create_page('Examples', '/examples', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
    {'id':'h1','type':'LubanHeading','props':{'content':'Examples & Templates','tag':'h1'}},
    {'id':'desc','type':'LubanMarkdown','props':{'content':'The following templates showcase typical use cases for Luban.\n'}},
    {'id':'row','type':'LubanRow','props':{},'children':[
        {'id':'c1','type':'LubanCol','props':{'span':8},'children':[
            {'id':'cr1','type':'LubanCard','props':{'title':'E-Commerce','description':'Banner + product grid + navigation + CTA','image':'https://placehold.co/400x200/e3f2fd/1976d2?text=E-Commerce'}}
        ]},
        {'id':'c2','type':'LubanCol','props':{'span':8},'children':[
            {'id':'cr2','type':'LubanCard','props':{'title':'Company Site','description':'Hero + features + team + contact','image':'https://placehold.co/400x200/f3e5f5/7b1fa2?text=Company'}}
        ]},
        {'id':'c3','type':'LubanCol','props':{'span':8},'children':[
            {'id':'cr3','type':'LubanCard','props':{'title':'Dashboard','description':'Data table + forms + charts','image':'https://placehold.co/400x200/e8f5e9/388e3c?text=Dashboard'}}
        ]},
    ]},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban'}},
])

# 7. Open Source
create_page('Open Source', '/open-source', [
    {'id':'nav','type':'LubanNavbar','props':{'title':'Luban'}},
    {'id':'md','type':'LubanMarkdown','props':{'content':(
        '# Open Source\n\n'
        'Luban is open-sourced under the **MIT License**.\n\n'
        '## Repository\n\n'
        '```\n'
        'luban-workspace/\n'
        '  apps/\n'
        '    engine/          # Low-code Engine (Vue 3, SPA)\n'
        '    bff/              # BFF (Next.js)\n'
        '    website/          # SSR Site (Nuxt 3)\n'
        '    backend-java/     # Java Backend (Spring Boot)\n'
        '  packages/\n'
        '    ui/               # UI Library (70+ components)\n'
        '    ai-assistant/     # AI Assistant\n'
        '  docs/               # Architecture docs\n'
        '```\n\n'
        '## Roadmap\n\n'
        '- [x] Visual drag-and-drop designer\n'
        '- [x] 70+ Material Design components\n'
        '- [x] SSR rendering\n'
        '- [x] AI natural language page generation\n'
        '- [ ] Enhanced form designer\n'
        '- [ ] i18n support\n'
        '- [ ] Dashboard components\n'
        '- [ ] Mobile app generation\n'
    )}},
    {'id':'footer','type':'LubanFooter','props':{'copyright':'2026 Luban - MIT License'}},
])

print('\nDone!')
