## 1. Static Landing Page

- [x] 1.1 Create `apps/website/pages/index.vue` with inline styles (Hero, Features, Components, CTA, Footer)
- [x] 1.2 Verify `npx nuxi generate` produces valid static output in `.output/public/`
- [x] 1.3 Verify generated page renders all sections correctly (curl + browser check)

## 2. Dev Scripts

- [x] 2.1 Add `build:landing` script to `apps/website/package.json` (swap router → generate → restore)
- [x] 2.2 Add `dev:landing` script to serve generated static with `npx serve`
- [x] 2.3 Verify `pnpm run dev:landing` works without BFF/backend

## 3. Nuxt Config

- [x] 3.1 Add bare `luban-base` / `luban-low-code` aliases to `nuxt.config.ts`
- [x] 3.2 Configure `optimizeDeps.exclude` to prevent Vite resolution errors
- [x] 3.3 Verify existing SSR page rendering is NOT broken by config changes

## 4. GitHub Pages CI/CD

- [x] 4.1 Create `.github/workflows/pages-deploy.yml` workflow
- [x] 4.2 Verify workflow builds UI packages, generates static, deploys
- [x] 4.3 Confirm GitHub Pages source is set to "GitHub Actions" in repo Settings

## 5. Validation

- [x] 5.1 Run E2E suite to confirm no regression: `cd apps/engine && LUBAN_E2E_USE_PLAYWRIGHT_CHROMIUM=1 npx playwright test`
- [x] 5.2 Manual browser test at `http://localhost:3000` after `pnpm run dev:landing`
- [x] 5.3 Verify `npx nuxi generate` output is <600KB
