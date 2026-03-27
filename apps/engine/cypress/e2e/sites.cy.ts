describe('Sites management', () => {
  beforeEach(() => {
    cy.loginWithToken()
  })

  it('loads site list and toolbar', () => {
    cy.visit('/sites')
    cy.contains('站点管理').should('be.visible')
    cy.contains('button', '新建站点').should('be.visible')
  })

  it('navigates to site detail from list', () => {
    cy.visit('/sites')
    cy.get('table').within(() => {
      cy.get('tbody tr').first().within(() => {
        cy.contains('详情').click()
      })
    })
    cy.url().should('match', /\\/sites\\/.+/)
    cy.contains('站点信息').should('be.visible')
  })

  it('navigates to site pages from list', () => {
    cy.visit('/sites')
    cy.get('table').within(() => {
      cy.get('tbody tr').first().within(() => {
        cy.contains('页面').click()
      })
    })
    cy.url().should('match', /\\/sites\\/.+\\/pages$/)
    cy.contains('站点：').should('be.visible')
    cy.contains('button', '新建页面').should('be.visible')
  })
}
