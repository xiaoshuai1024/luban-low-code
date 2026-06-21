/**
 * designer-drop-e2e.cy.ts — 拖放端到端测试（新建页面，不需 API 创建）。
 */
describe('Designer — 拖放全流程验证', () => {
  const siteId = '2ad35b19-22bb-4cc8-811d-073d969e3966'

  before(() => {
    // 登录获取 token
    const account = Cypress.env('LUBAN_E2E_ACCOUNT') || 'e2e'
    const password = Cypress.env('LUBAN_E2E_PASSWORD') || 'e2e@2026'
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { username: account, password },
    }).then((resp) => {
      cy.wrap(resp.body.token).as('authToken')
    })
  })

  beforeEach(function () {
    // 用真实 token 导航到新建页面（不依赖 API，走客户端空白 schema）
    cy.loginReal(`/designer/sites/${siteId}/pages/new`)
    // 等待编辑器加载
    cy.contains('组件', { timeout: 15000 }).should('be.visible')
  })

  it('1. 新建页面：三栏布局渲染完整', () => {
    // 左侧面板
    cy.get('.page-editor__panel-title').should('contain', '组件')
    // 搜索框
    cy.get('.page-editor__palette-search-input').should('exist')
    // 物料列表
    cy.get('.page-editor__palette-item').should('have.length.at.least', 3)
    // 每个物料可拖拽
    cy.get('.page-editor__palette-item').first().should('have.attr', 'draggable', 'true')
    // 画布
    cy.get('.luban-designer__canvas').should('exist')
    // 网格背景
    cy.get('.luban-designer__canvas--grid').should('exist')
    // 空状态 placeholder
    cy.get('.luban-designer__placeholder').should('be.visible')
    cy.get('.luban-designer__placeholder').should('contain', '从左侧拖拽组件到此处')
  })

  it('2. 拖拽文本组件到空画布 → 组件出现', () => {
    // 确认空画布
    cy.get('.luban-designer__placeholder').should('be.visible')

    // 找到"文本"组件并拖放
    cy.get('.page-editor__palette-item').contains('文本').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanText' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', {
        dataTransfer: dt, bubbles: true, cancelable: true,
      }))

      // 拖到画布 placeholder 上
      cy.get('.luban-designer__placeholder').first().then(($dz) => {
        // dragover（必须，允许 drop）
        $dz[0].dispatchEvent(new DragEvent('dragover', {
          dataTransfer: dt, bubbles: true, cancelable: true,
        }))
        // drop
        $dz[0].dispatchEvent(new DragEvent('drop', {
          dataTransfer: dt, bubbles: true, cancelable: true,
        }))
      })
    })

    // 验证：placeholder 消失
    cy.get('.luban-designer__placeholder').should('not.exist')
    // 验证：sortable item 出现
    cy.get('.luban-designer__sortable-item').should('have.length.at.least', 1)
    // 验证：组件树中出现"文本"
    cy.get('.component-tree__node').contains('文本').should('exist')
  })

  it('3. 再拖按钮 → 画布中有 2 个节点', () => {
    // 先拖文本
    cy.get('.page-editor__palette-item').contains('文本').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanText' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__placeholder').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })

    cy.get('.luban-designer__sortable-item').should('have.length', 1)

    // 再拖按钮
    cy.get('.page-editor__palette-item').contains('按钮').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanButton' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      cy.get('.luban-designer__canvas-spacer').first().then(($z) => {
        $z[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
      })
    })

    cy.get('.luban-designer__sortable-item').should('have.length', 2)
  })

  // Electron headless 不支持完整的 dragenter 事件链，skip
  it.skip('4. 拖入视觉反馈：dragenter → 画布高亮 + 提示浮层', () => {
    cy.get('.page-editor__palette-item').contains('文本').then(($el) => {
      const dt = new DataTransfer()
      dt.setData('application/json', JSON.stringify({ type: 'LubanText' }))
      $el[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))

      // dragenter 需要在元素链上依次触发
      cy.get('.luban-designer__canvas').then(($canvas) => {
        const canvasEl = $canvas[0]
        // 先触发 dragover（Electron 可能要求先有 dragover 才能 dragenter）
        canvasEl.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
        // 再触发 dragenter
        canvasEl.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }))
      })
    })

    // 画布高亮
    cy.get('.luban-designer__canvas--drop-active').should('exist')
  })

  it('5. 缩放控件：+/- 按钮正常工作', () => {
    // 缩放工具栏可见
    cy.get('.luban-designer__builtin-toolbar').should('be.visible')
    cy.get('.luban-designer__zoom-label').should('contain', '100%')

    // 放大
    cy.get('.luban-designer__zoom-btn').eq(1).click()
    cy.get('.luban-designer__zoom-label').should('contain', '110%')

    // 缩小
    cy.get('.luban-designer__zoom-btn').eq(0).click()
    cy.get('.luban-designer__zoom-label').should('contain', '100%')

    // 网格切换
    cy.get('.luban-designer__toggle-btn').first().click()
    cy.get('.luban-designer__canvas--grid').should('not.exist')
    cy.get('.luban-designer__toggle-btn').first().click()
    cy.get('.luban-designer__canvas--grid').should('exist')
  })
})
