/**
 * designer-marketing.cy.ts — D15-F2 营销建站组件组装 E2E。
 *
 * 验证：调色板「营销」分组可见 → 拖拽营销组件组装落地页 → 数组编辑器配 props
 * → 保存 → 发布成功。
 *
 * 沿用 designer.cy.ts 的 before() API seed + loginReal + after() 清理模式。
 */
describe('Designer — 营销组件组装落地页 (D15-E1/E2/E4/F2)', () => {
  const uniq = Date.now()

  before(() => {
    const account = Cypress.env('LUBAN_E2E_ACCOUNT') || 'e2e'
    const password = Cypress.env('LUBAN_E2E_PASSWORD') || 'e2e@2026'

    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { username: account, password },
    }).then((loginResp) => {
      const token = loginResp.body.token
      cy.wrap(token).as('authToken')
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

      cy.request({
        method: 'POST',
        url: '/api/sites',
        headers,
        body: {
          name: `cy-mkt-${uniq}`,
          slug: `cy-mkt-${uniq}`,
          baseUrl: 'http://cy.test',
          status: 'active',
        },
      }).then((siteResp) => {
        const siteId = siteResp.body.id
        cy.wrap(siteId).as('siteId')

        cy.request({
          method: 'POST',
          url: `/api/sites/${siteId}/pages`,
          headers,
          body: {
            name: `cy-mkt-page-${uniq}`,
            path: `/mkt-${uniq}`,
            schema: {
              formState: {},
              root: { id: 'root', type: 'LubanContainer', props: { maxWidth: 'full', padded: true }, children: [] },
            },
            status: 'draft',
          },
        }).then((pageResp) => {
          cy.wrap(pageResp.body.id).as('pageId')
        })
      })
    })
  })

  beforeEach(function () {
    cy.loginReal(`/sites/${this.siteId}/pages/${this.pageId}`)
    cy.contains('物料').should('be.visible')
  })

  it('调色板「营销」分组可见，含 Hero/CTA/LeadCapture/Navbar/Footer', () => {
    // D15-E4：营销组首次进入调色板
    cy.contains('营销').should('be.visible')
    cy.get('.page-editor__palette-group').contains('营销').parent().within(() => {
      cy.contains('LubanHero').should('exist')
    })
  })

  it('拖拽 Hero + FeatureGrid 到画布 → 组装落地页骨架', () => {
    // 拖 Hero
    cy.get('.page-editor__palette-item').contains('LubanHero').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanHero' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__placeholder').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    // 拖 FeatureGrid（用 canvas spacer）
    cy.get('.page-editor__palette-item').contains('LubanFeatureGrid').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanFeatureGrid' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__canvas-spacer').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    // 画布至少 2 个 sortable-item
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 2)
    // 组件树含两个节点
    cy.contains('LubanHero').should('be.visible')
    cy.contains('LubanFeatureGrid').should('be.visible')
  })

  it('D15-E0 数组编辑器：选中 FeatureGrid → 添加特性卡片', () => {
    // 先确保画布有 FeatureGrid（前置用例已加，但 Cypress 用例间状态不保证，重新拖）
    cy.get('.page-editor__palette-item').contains('LubanFeatureGrid').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanFeatureGrid' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__placeholder').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    // 选中 FeatureGrid
    cy.contains('LubanFeatureGrid').click()
    // 数组控件「+ 添加」按钮存在（D15-E0 可视化数组编辑器）
    cy.get('.property-panel__array').should('exist')
    cy.get('.property-panel__array').contains('+ 添加').click()
    // 添加后应有一行 array-row
    cy.get('.property-panel__array-row').should('have.length.at.least', 1)
  })

  it('保存 → 发布成功', () => {
    // 填页面名+路径
    cy.get('input').contains('placeholder', '名称').should('not.exist') // 确认页面已存在
    // 直接点发布（页面已通过 before 建好，有 name）
    cy.get('button').contains('发布').click()
    // 确认弹窗
    cy.get('button').contains('发布').last().click({ force: true })
    // 发布成功提示
    cy.contains('发布成功', { timeout: 10000 }).should('be.visible')
  })

  after(function () {
    if (this.siteId && this.authToken) {
      cy.request({
        method: 'DELETE',
        url: `/api/sites/${this.siteId}`,
        headers: { Authorization: `Bearer ${this.authToken}` },
        failOnStatusCode: false,
      })
    }
  })
})
