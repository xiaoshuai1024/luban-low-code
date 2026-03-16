export {}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Set JWT token in localStorage and optionally visit a path
       */
      loginWithToken(token?: string, visitPath?: string): Chainable<void>
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
