/**
 * designer-keyboard.cy.ts — V2-T0 键盘快捷键全套覆盖。
 *
 * 补齐 P 类缺口：L/H/Delete/Ctrl+S/Z/Y/D 全部键盘触发（此前只测按钮点击）。
 * 沿用 designer.cy.ts 的 before() API-seed + loginReal 模式。
 */
describe('Designer — 键盘快捷键 (V2-T0)', () => {
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
        body: { name: `cy-kb-${uniq}`, slug: `cy-kb-${uniq}`, baseUrl: 'http://cy.test', status: 'active' },
      }).then((siteResp) => {
        const siteId = siteResp.body.id
        cy.wrap(siteId).as('siteId')
        cy.request({
          method: 'POST',
          url: `/api/sites/${siteId}/pages`,
          headers,
          body: {
            name: `cy-kb-page-${uniq}`,
            path: `/kb-${uniq}`,
            schema: { formState: {}, root: { id: 'root', type: 'LubanContainer', props: { maxWidth: 'full', padded: true }, children: [] } },
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

  /** 拖一个文本组件到画布的辅助（复用模式） */
  function dragText(): void {
    cy.get('.page-editor__palette-item').contains('文本').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanText' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__placeholder').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
  }

  /** 选中画布首个节点 */
  function selectFirst(): void {
    cy.get('.luban-designer__sortable-item').first().click()
  }

  it('Delete 键 → 删除选中节点', () => {
    dragText()
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 1)
    selectFirst()
    // 按 Delete 键（document body focus，非 input 态）
    cy.get('body').type('{del}')
    // 节点应被删除（placeholder 重新出现）
    cy.get('.luban-designer__placeholder').should('be.visible')
  })

  it('L 键 → 切换锁定态（badge 出现/消失）', () => {
    dragText()
    selectFirst()
    // 按 L 键锁定
    cy.get('body').type('l')
    cy.get('.component-tree__badge[title="已锁定"]').should('exist')
    // 再按 L 解锁
    cy.get('body').type('l')
    cy.get('.component-tree__badge[title="已锁定"]').should('not.exist')
  })

  it('H 键 → 切换隐藏态', () => {
    dragText()
    selectFirst()
    cy.get('body').type('h')
    cy.get('.component-tree__badge[title="已隐藏"]').should('exist')
    // 再按 H 显示
    cy.get('body').type('h')
    cy.get('.component-tree__badge[title="已隐藏"]').should('not.exist')
  })

  it('Ctrl+Z → 撤销（删除的节点恢复）', () => {
    dragText()
    selectFirst()
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 1)
    // Delete 删除
    cy.get('body').type('{del}')
    cy.get('.luban-designer__placeholder').should('be.visible')
    // Ctrl+Z 撤销
    cy.get('body').type('{ctrl}z')
    // 节点应恢复（placeholder 消失）
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 1)
  })

  it('Ctrl+Shift+Z → 重做（撤销后重做再删除）', () => {
    dragText()
    selectFirst()
    cy.get('body').type('{del}')
    cy.get('.luban-designer__placeholder').should('be.visible')
    // 撤销
    cy.get('body').type('{ctrl}z')
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 1)
    // 重做（Ctrl+Shift+Z）
    cy.get('body').type('{ctrl}{shift}z')
    // 节点应再次被删除
    cy.get('.luban-designer__placeholder').should('be.visible')
  })

  it('Ctrl+D → 复制节点（画布出现 2 个）', () => {
    dragText()
    selectFirst()
    cy.get('.luban-designer__sortable-item').should('have.length', 1)
    cy.get('body').type('{ctrl}d')
    // 复制后应有 2 个
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 2)
  })

  it('Ctrl+S → 保存（成功提示）', () => {
    // 页面已存在（before 建好），Ctrl+S 应触发保存
    cy.get('body').type('{ctrl}s')
    cy.contains('保存成功', { timeout: 8000 }).should('be.visible')
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
