describe('Lead Center', () => {
  // Real site/lead data created via API before all tests
  let siteId: string
  let leadName: string

  before(() => {
    // Create a site + form + lead via API to have real data to test against
    const account = Cypress.env('LUBAN_E2E_ACCOUNT') || 'e2e'
    const password = Cypress.env('LUBAN_E2E_PASSWORD') || 'e2e@2026'
    const uniq = Date.now()
    leadName = `Cypress访客${uniq}`

    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { username: account, password },
    }).then((loginResp) => {
      const token = loginResp.body.token
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

      // Create site
      cy.request({
        method: 'POST',
        url: '/api/sites',
        headers,
        body: { name: `cy-lead-${uniq}`, slug: `cy-lead-${uniq}`, baseUrl: 'http://cy.test', status: 'active' },
      }).then((siteResp) => {
        siteId = siteResp.body.id

        // Create page
        cy.request({
          method: 'POST',
          url: `/api/sites/${siteId}/pages`,
          headers,
          body: { name: `cy-lead-page-${uniq}`, path: '/lead-test', schema: { formState: {}, root: { id: 'root', type: 'LubanContainer', props: {}, children: [] } }, status: 'published' },
        }).then((pageResp) => {
          const pageId = pageResp.body.id

          // Create form
          cy.request({
            method: 'POST',
            url: '/api/forms',
            headers,
            body: { siteId, pageId, name: `cy-lead-form-${uniq}`, fieldSchema: { fields: [{ name: 'name', label: '姓名', type: 'text', required: true }, { name: 'phone', label: '手机号', type: 'tel', required: true }] }, dedupKeys: ['phone'], status: 'active' },
          }).then((formResp) => {
            const formId = formResp.body.id

            // Submit a lead
            cy.request({
              method: 'POST',
              url: `/api/forms/${formId}/submit`,
              headers: { 'Content-Type': 'application/json' },
              body: { formId, contact: { name: leadName, phone: `138${String(uniq).slice(-8)}`, source: 'cypress-e2e' } },
            })
          })
        })
      })
    })
  })

  beforeEach(() => {
    cy.loginReal(`/sites/${siteId}/leads`)
  })

  it('loads lead list page with toolbar and table', () => {
    cy.contains('线索中心').should('be.visible')
    cy.get('button').contains('查询').should('be.visible')
    cy.get('button').contains('导出 CSV').should('be.visible')
    cy.get('table').should('be.visible')
  })

  it('displays the newly created lead in the list', () => {
    cy.contains(leadName).should('be.visible')
  })

  it('navigates to lead detail', () => {
    cy.get('button').contains('详情').first().click()
    cy.contains('线索详情').should('be.visible')
    cy.contains('联系人信息').should('be.visible')
  })

  it('displays contact info in detail', () => {
    cy.get('button').contains('详情').first().click()
    cy.contains('联系人信息').should('be.visible')
    cy.contains('name').should('be.visible')
    cy.contains('phone').should('be.visible')
    cy.contains(leadName).should('be.visible')
  })

  it('returns to list from detail page', () => {
    cy.get('button').contains('详情').first().click()
    cy.contains('← 返回列表').click()
    cy.contains('线索中心').should('be.visible')
  })

  it('exports leads as CSV', () => {
    cy.get('button').contains('导出 CSV').click()
    cy.contains('导出成功').should('be.visible')
  })

  it('shows 404 alert when navigating to non-existent lead', () => {
    cy.visit(`/sites/${siteId}/leads/non-existent-id`)
    cy.get('.el-alert--warning').should('be.visible')
    cy.contains('线索不存在').should('be.visible')
  })
})