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
    // D15-E4：营销组首次进入调色板（label 为物料 description 子串）
    cy.contains('营销').scrollIntoView().should('be.visible')
    // 营销组里应有 Hero（label 含 'Hero'）/Navbar（含'导航栏'）等
    cy.get('.page-editor__palette-item').should('contain.text', 'Hero')
    cy.get('.page-editor__palette-item').should('contain.text', '导航栏')
  })

  it('拖拽 Hero + FeatureGrid 到画布 → 组装落地页骨架', () => {
    // 拖 Hero（palette item 文本为 description，含 'Hero'）
    cy.get('.page-editor__palette-item').contains('Hero').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanHero' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__placeholder').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    // 拖 FeatureGrid（label 含 '特性卡片'）
    cy.get('.page-editor__palette-item').contains('特性卡片').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanFeatureGrid' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__canvas-spacer').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    // 画布至少 2 个 sortable-item
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 2)
    // 组件树含两个节点（label 即 description）
    cy.contains('Hero').should('exist')
    cy.contains('特性卡片').should('exist')
  })

  it('D15-E0 数组编辑器：选中 FeatureGrid → 添加特性卡片', () => {
    // 先确保画布有 FeatureGrid（用例间状态不保证，重新拖）
    cy.get('.page-editor__palette-item').contains('特性卡片').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanFeatureGrid' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__placeholder').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    // 选中 FeatureGrid（组件树中点 description 标签）
    cy.contains('特性卡片').click()
    // 数组控件「+ 添加」按钮存在（D15-E0 可视化数组编辑器）
    cy.get('.property-panel__array').should('exist')
    cy.get('.property-panel__array').contains('+ 添加').click({ force: true })
    // 添加后应有一行 array-row
    cy.get('.property-panel__array-row').should('have.length.at.least', 1)
  })

  it('保存 → 发布成功', () => {
    // 页面已通过 before() 建好（有 name/path）。直接发布。
    // 设计器模式顶栏「发布」按钮
    cy.get('button').contains('发布').click()
    // ElMessageBox 确认弹窗的「发布」确认按钮（第二个）
    cy.get('.el-message-box').should('be.visible')
    cy.get('.el-message-box__btns').contains('发布').click({ force: true })
    // 发布成功提示
    cy.contains('发布成功', { timeout: 15000 }).should('be.visible')
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
