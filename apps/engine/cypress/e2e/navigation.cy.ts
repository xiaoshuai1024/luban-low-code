describe('Navigation', () => {
  beforeEach(() => {
    cy.loginWithToken()
  })

  it('dashboard is accessible', () => {
    cy.visit('/dashboard')
    cy.contains('工作台').should('be.visible')
    cy.contains('站点数').should('be.visible')
  })

  it('sidebar links work', () => {
    cy.visit('/dashboard')
    cy.contains('a', '站点管理').click()
    cy.url().should('include', '/sites')
    cy.contains('用户管理').click()
    cy.url().should('include', '/users')
    cy.contains('系统设置').click()
    cy.url().should('include', '/settings')
  })

  it('sites list page loads', () => {
    cy.visit('/sites')
    cy.contains('站点管理').should('be.visible')
    cy.get('button').contains('新建站点').should('be.visible')
  })

  it('users list page loads', () => {
    cy.visit('/users')
    cy.contains('用户管理').should('be.visible')
    cy.get('button').contains('新建用户').should('be.visible')
  })

  it('settings page loads', () => {
    cy.visit('/settings')
    cy.contains('系统设置').should('be.visible')
    cy.contains('基础信息').should('be.visible')
  })
})
