import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: false,
  },
  env: {
    LUBAN_E2E_ACCOUNT: 'e2e',
    LUBAN_E2E_PASSWORD: 'e2e@2026',
  },
})
