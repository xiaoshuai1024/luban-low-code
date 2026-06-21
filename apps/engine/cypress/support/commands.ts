export {}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Set JWT token in localStorage and optionally visit a path
       */
      loginWithToken(token?: string, visitPath?: string): Chainable<void>
      /**
       * Real login via BFF API — fetches a real JWT token and sets it in localStorage
       */
      loginReal(visitPath?: string): Chainable<void>
    }
  }
}

const MOCK_TOKEN = 'mock-jwt-token'

Cypress.Commands.add('loginWithToken', (token = MOCK_TOKEN, visitPath = '/dashboard') => {
  cy.window().then((win) => {
    win.localStorage.setItem('luban_token', token)
  })
  if (visitPath) {
    cy.visit(visitPath)
  }
})

/**
 * Log in via real BFF API and store the JWT token in localStorage.
 * Requires the backend + BFF to be running (as configured in the Vite proxy / .env).
 */
Cypress.Commands.add('loginReal', (visitPath = '/dashboard') => {
  const account = Cypress.env('LUBAN_E2E_ACCOUNT') || 'e2e'
  const password = Cypress.env('LUBAN_E2E_PASSWORD') || 'e2e@2026'
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { username: account, password },
    headers: { 'Content-Type': 'application/json' },
  }).then((resp) => {
    const token = resp.body.token
    expect(token, 'BFF login should return token').to.be.a('string').and.not.empty
    cy.window().then((win) => {
      win.localStorage.setItem('luban_token', token)
    })
    if (visitPath) {
      cy.visit(visitPath)
    }
  })
})
