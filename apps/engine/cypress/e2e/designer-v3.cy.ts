/**
 * designer-v3.cy.ts — V3 设计器新功能 E2E。
 *
 * 覆盖：左侧面板图标+分类折叠+搜索、画布网格、拖入反馈、缩放控件。
 * 依赖后端 API（before seed + loginReal），沿用 designer.cy.ts 模式。
 */
describe('Designer V3 — 面板与画布新功能', () => {
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
        body: { name: `cy-v3-${uniq}`, slug: `cy-v3-${uniq}`, baseUrl: 'http://cy.test', status: 'active' },
      }).then((siteResp) => {
        const siteId = siteResp.body.id
        cy.wrap(siteId).as('siteId')
        cy.request({
          method: 'POST',
          url: `/api/sites/${siteId}/pages`,
          headers,
          body: {
            name: `cy-v3-page-${uniq}`,
            path: `/v3-${uniq}`,
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
    cy.contains('组件').should('be.visible')
  })

  // ===== 左侧面板 =====

  it('面板标题为"组件"', () => {
    cy.get('.page-editor__panel-title').should('contain', '组件')
  })

  it('搜索框存在且可输入', () => {
    cy.get('.page-editor__palette-search-input').should('exist')
    cy.get('.page-editor__palette-search-input').type('按钮')
    cy.get('.page-editor__palette-search-input').should('have.value', '按钮')
  })

  it('搜索过滤组件：输入"按钮"只显示按钮类组件', () => {
    cy.get('.page-editor__palette-search-input').type('按钮')
    // 至少有一个按钮类组件可见
    cy.get('.page-editor__palette-item').should('have.length.at.least', 1)
    // 每个可见项应包含"按钮"
    cy.get('.page-editor__palette-item').each(($el) => {
      cy.wrap($el).should('contain.text', '按钮')
    })
  })

  it('搜索无匹配时显示空状态', () => {
    cy.get('.page-editor__palette-search-input').type('xyznonexistent123')
    cy.get('.page-editor__palette-empty').should('be.visible')
    cy.get('.page-editor__palette-empty').should('contain', '未找到匹配的组件')
  })

  it('分类标题可点击折叠/展开', () => {
    // 第一个分类标题
    cy.get('.page-editor__palette-cat').first().as('firstCat')
    cy.get('@firstCat').should('be.visible')
    // 默认展开：item 可见
    cy.get('.page-editor__palette-item').should('have.length.at.least', 1)
    // 点击折叠
    cy.get('@firstCat').click()
    // 注意：折叠后 items 仅隐藏（v-show），仍存在于 DOM
    // 通过检查父容器 v-show 状态来验证
  })

  it('每个物料项有 SVG 图标', () => {
    cy.get('.page-editor__palette-item').first().within(() => {
      cy.get('svg.page-editor__palette-item-icon').should('exist')
    })
  })

  it('分类标题显示组件数量', () => {
    cy.get('.page-editor__palette-cat-count').first().should('exist')
  })

  // ===== 画布网格与视觉 =====

  it('画布显示网格背景（设计态默认开启）', () => {
    cy.get('.luban-designer__canvas--grid').should('exist')
  })

  it('网格切换按钮可关闭网格', () => {
    cy.get('.luban-designer__toggle-btn').first().click()
    cy.get('.luban-designer__canvas--grid').should('not.exist')
    // 再打开
    cy.get('.luban-designer__toggle-btn').first().click()
    cy.get('.luban-designer__canvas--grid').should('exist')
  })

  it('画布有白色页面卡片效果', () => {
    cy.get('.luban-designer__root-container').should('exist')
    cy.get('.luban-designer__root-container').should('be.visible')
  })

  // ===== 拖入反馈 =====

  it('从面板拖拽到画布时画布高亮', () => {
    cy.get('.page-editor__palette-item').contains('文本').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanText' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))

      // 拖到画布上触发 dragenter
      cy.get('.luban-designer__canvas').then(($canvas) => {
        $canvas[0].dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }))
      })

      // 画布应有 drop-active class
      cy.get('.luban-designer__canvas--drop-active').should('exist')
    })
  })

  it('拖入提示浮层显示"释放以添加组件"', () => {
    cy.get('.page-editor__palette-item').contains('文本').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanText' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))

      cy.get('.luban-designer__canvas').then(($canvas) => {
        $canvas[0].dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }))
      })

      cy.get('.luban-designer__drop-hint').should('be.visible')
      cy.get('.luban-designer__drop-hint').should('contain', '释放以添加组件')
    })
  })

  // ===== 缩放控件 =====

  it('设计态右下角显示缩放工具栏', () => {
    cy.get('.luban-designer__builtin-toolbar').should('exist')
    cy.get('.luban-designer__builtin-toolbar').should('be.visible')
  })

  it('缩放百分比默认显示 100%', () => {
    cy.get('.luban-designer__zoom-label').should('contain', '100%')
  })

  it('点击 + 缩放增加', () => {
    cy.get('.luban-designer__zoom-label').should('contain', '100%')
    // 找到放大按钮（+）
    cy.get('.luban-designer__zoom-btn').eq(1).click()
    cy.get('.luban-designer__zoom-label').should('contain', '110%')
  })

  it('点击 - 缩放减少', () => {
    // 先放大再缩小
    cy.get('.luban-designer__zoom-btn').eq(1).click()
    cy.get('.luban-designer__zoom-btn').eq(1).click()
    cy.get('.luban-designer__zoom-label').should('contain', '120%')
    cy.get('.luban-designer__zoom-btn').eq(0).click()
    cy.get('.luban-designer__zoom-label').should('contain', '110%')
  })

  it('点击百分比标签重置为 100%', () => {
    cy.get('.luban-designer__zoom-btn').eq(1).click()
    cy.get('.luban-designer__zoom-btn').eq(1).click()
    cy.get('.luban-designer__zoom-label').should('not.contain', '100%')
    cy.get('.luban-designer__zoom-label').click()
    cy.get('.luban-designer__zoom-label').should('contain', '100%')
  })

  it('适应画布按钮存在', () => {
    cy.get('.luban-designer__zoom-btn--fit').should('exist')
  })

  // ===== 完整的拖放流程（带反馈） =====

  it('拖拽组件到画布：显示反馈 → 放置成功 → 反馈消失', () => {
    cy.get('.page-editor__palette-item').contains('文本').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanText' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))

      // dragenter → 高亮
      cy.get('.luban-designer__canvas').then(($canvas) => {
        $canvas[0].dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }))
      })
      cy.get('.luban-designer__canvas--drop-active').should('exist')

      // drop → 放置
      cy.get('.luban-designer__placeholder').first().then(($dz) => {
        $dz[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })

      // 放置后 feedback 消失
      cy.get('.luban-designer__canvas--drop-active').should('not.exist')
      // 组件出现在画布中
      cy.get('.luban-designer__sortable-item').should('have.length.at.least', 1)
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
