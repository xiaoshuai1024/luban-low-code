describe('Pages management', () => {
  beforeEach(() => {
    cy.loginWithToken()
  })

  it('loads page list for a site', () => {
    // assumes at least one site exists; adjust fixture/seeding if needed
    cy.visit('/sites')
    cy.get('table tbody tr').first().within(() => {
      cy.contains('页面').click()
    })
    cy.url().should('match', /\\/sites\\/.+\\/pages$/)
    cy.contains('站点：').should('be.visible')
    cy.contains('button', '新建页面').should('be.visible')
  })

  it('opens new page editor', () => {
    cy.visit('/sites')
    cy.get('table tbody tr').first().within(() => {
      cy.contains('页面').click()
    })
    cy.contains('button', '新建页面').click()
    cy.url().should('match', /\\/sites\\/.+\\/pages\\/new$/)
    cy.contains('页面名称').should('be.visible')
    cy.contains('路径').should('be.visible')
    cy.contains('button', '保存').should('be.visible')
    cy.contains('button', '返回列表').should('be.visible')
  })
})
