describe('Pages management', () => {
  beforeEach(() => {
    cy.loginReal()
  })

  it('loads page list for a site', () => {
    // assumes at least one site exists; adjust fixture/seeding if needed
    cy.visit('/sites')
    cy.get('table.el-table__body').should('be.visible').then(($tables) => {
      cy.wrap($tables.first()).within(() => {
        cy.get('tr').contains('页面').click()
      })
    })
    cy.url().should('match', /\/sites\/.+\/pages$/)
    cy.contains('站点：').should('be.visible')
    cy.contains('button', '新建页面').should('be.visible')
  })

  it('opens new page editor', () => {
    cy.visit('/sites')
    cy.get('table.el-table__body').should('be.visible').then(($tables) => {
      cy.wrap($tables.first()).within(() => {
        cy.get('tr').contains('页面').click()
      })
    })
    cy.contains('button', '新建页面').click()
    // 独立设计器路由：顶栏显示页面信息
    cy.url().should('include', '/designer/sites/')
    cy.url().should('match', /\/pages\/new$/)
    cy.contains('未命名页面').should('be.visible')
  })
})
