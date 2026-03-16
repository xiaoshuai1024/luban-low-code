describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  it('shows login form', () => {
    cy.contains('Luban 管理后台').should('be.visible')
    cy.get('input[placeholder="请输入账号"]').should('be.visible')
    cy.get('input[placeholder="请输入密码"]').should('be.visible')
    cy.contains('button', '登录').should('be.visible')
  })

  it('redirects to dashboard when token exists', () => {
    cy.loginWithToken('existing-token', '/login')
    cy.url().should('include', '/dashboard')
  })

  it('unauthenticated user is redirected to login when visiting dashboard', () => {
    cy.window().then((win) => win.localStorage.removeItem('luban_token'))
    cy.visit('/dashboard')
    cy.url().should('include', '/login')
  })
})
