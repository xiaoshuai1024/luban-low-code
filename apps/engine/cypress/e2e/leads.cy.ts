describe('Lead Center', () => {
  beforeEach(() => {
    cy.loginWithToken()
  })

  it('loads lead list page with toolbar and table', () => {
    cy.visit('/leads')
    cy.contains('线索中心').should('be.visible')
    cy.get('button').contains('查询').should('be.visible')
    cy.get('button').contains('导出 CSV').should('be.visible')
    cy.get('table').should('be.visible')
    // should show at least one lead row
    cy.get('table tbody tr').should('have.length.at.least', 1)
  })

  it('displays lead status tags correctly', () => {
    cy.visit('/leads')
    cy.contains('新线索').should('be.visible')
    cy.contains('已分配').should('be.visible')
  })

  it('filters leads by status', () => {
    cy.visit('/leads')
    // Open status filter dropdown
    cy.get('.el-select').first().click()
    cy.get('.el-select-dropdown__item').contains('新线索').click()
    cy.get('table tbody tr').each(($row) => {
      cy.wrap($row).should('contain', '新线索')
    })
  })

  it('navigates to lead detail on row double-click or detail button', () => {
    cy.visit('/leads')
    cy.get('button').contains('详情').first().click()
    cy.url().should('include', '/leads/lead-1')
    cy.contains('线索详情').should('be.visible')
    cy.contains('联系人信息').should('be.visible')
  })

  it('displays lead detail with contact info and status', () => {
    cy.visit('/leads')
    cy.get('button').contains('详情').first().click()
    cy.contains('手机号').should('be.visible')
    cy.contains('138****8000').should('be.visible')
    cy.contains('新线索').should('be.visible')
  })

  it('shows status transition buttons based on current status', () => {
    cy.visit('/leads')
    // First lead is 'new' status — should show '已分配' and '无效' transition buttons
    cy.get('table tbody tr').first().within(() => {
      cy.contains('新线索').should('be.visible')
    })
    cy.get('button').contains('已分配').should('be.visible')
    cy.get('button').contains('无效').should('be.visible')
  })

  it('performs status transition via inline button', () => {
    cy.visit('/leads')
    cy.get('button').contains('已分配').click()
    // Confirmation dialog
    cy.get('.el-message-box').should('be.visible')
    cy.get('.el-message-box__btns .el-button--primary').click()
    // After transition, should show updated status or success message
    cy.contains('已分配').should('be.visible')
  })

  it('performs status transition from detail page', () => {
    cy.visit('/leads')
    cy.get('button').contains('详情').first().click()
    // Should see status section with transition buttons
    cy.contains('状态变更').should('be.visible')
    cy.get('button').contains('已分配').click()
    cy.get('.el-message-box').should('be.visible')
    cy.get('.el-message-box__btns .el-button--primary').click()
    cy.contains('状态已变更为').should('be.visible')
  })

  it('shows UTM info when available', () => {
    cy.visit('/leads')
    cy.get('button').contains('详情').first().click()
    // First lead has UTM data
    cy.contains('UTM 参数').should('be.visible')
    cy.contains('source').should('be.visible')
    cy.contains('google').should('be.visible')
  })

  it('returns to list from detail page', () => {
    cy.visit('/leads')
    cy.get('button').contains('详情').first().click()
    cy.contains('← 返回列表').click()
    cy.contains('线索中心').should('be.visible')
  })
})
