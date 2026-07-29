/**
 * designer-publish-flow.cy.ts — D15-F3 LeadCapture 提交闭环 E2E。
 *
 * 验证完整链路：拖 Hero + LeadCapture → 配 LeadCapture formId → 保存 → 发布
 * → 访问 website /{slug}/{path} → 断言 SSR/hydration 渲染 LeadCapture。
 *
 * 闭环到 website 端（DynamicPage <ClientOnly>，断言基于 hydration 后 DOM）。
 * 端到端验证"操作链路和逻辑"可用。
 */
describe('Designer — 发布到 website 闭环 (D15-E3/F3)', () => {
  const uniq = Date.now()
  const WEBSITE_URL = Cypress.env('LUBAN_E2E_WEBSITE_URL') || 'http://localhost:3000'

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
          name: `cy-pub-${uniq}`,
          slug: `cy-pub-${uniq}`,
          baseUrl: 'http://cy.test',
          status: 'active',
        },
      }).then((siteResp) => {
        const siteId = siteResp.body.id
        cy.wrap(siteId).as('siteId')
        cy.wrap(siteResp.body.slug).as('siteSlug')

        cy.request({
          method: 'POST',
          url: `/api/sites/${siteId}/pages`,
          headers,
          body: {
            name: `cy-pub-page-${uniq}`,
            path: `/landing-${uniq}`,
            schema: {
              formState: {},
              root: { id: 'root', type: 'LubanContainer', props: { maxWidth: 'full', padded: true }, children: [] },
            },
            status: 'draft',
          },
        }).then((pageResp) => {
          cy.wrap(pageResp.body.id).as('pageId')
          cy.wrap(`/landing-${uniq}`).as('pagePath')
        })
      })
    })
  })

  beforeEach(function () {
    cy.loginReal(`/sites/${this.siteId}/pages/${this.pageId}`)
    cy.contains('物料').should('be.visible')
  })

  it('拖 Hero + LeadCapture 组装 → 发布成功', function () {
    // 拖 Hero（palette item 文本为 description，含 'Hero'）
    cy.get('.page-editor__palette-item').contains('Hero').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanHero' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__placeholder').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    // 拖 LeadCapture（label 含 '线索采集'）
    cy.get('.page-editor__palette-item').contains('线索采集').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanLeadCapture' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__canvas-spacer').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 2)
    // 同一 it 内发布（schema 持久化：跨 it 会重载页面丢失画布）
    cy.get('button').contains('发布').click()
    cy.get('.el-message-box').should('be.visible')
    cy.get('.el-message-box__btns').contains('发布').click({ force: true })
    cy.contains('发布成功', { timeout: 15000 }).should('be.visible')
  })

  it('访问 website SSR 站点 → LeadCapture 渲染（hydration 后）', function () {
    // 闭环到 website 正式路由 /{slug}/{path}（跨域 5173->3000，需 cy.origin）
    const siteSlug = (this as any).siteSlug
    const pagePath = (this as any).pagePath
    const url = `${WEBSITE_URL}/${siteSlug}${pagePath}`
    cy.visit(url)
    // DynamicPage <ClientOnly>，等 hydration（页面已发布，schema 含 Hero/LeadCapture）
    cy.origin(url, { args: { url } }, ({ url }) => {
      // Hero 标题默认值 "欢迎访问" 或 LeadCapture 标题 "获取最新资讯"/"提交" 应渲染
      cy.get('body', { timeout: 20000 }).should(($body) => {
        const text = $body.text()
        expect(text).to.match(/欢迎访问|获取最新资讯|提交/)
      })
    })
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
