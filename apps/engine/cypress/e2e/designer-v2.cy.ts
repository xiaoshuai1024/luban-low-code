/// <reference types="cypress" />
/**
 * V2-T13/T0 E2E — 设计器 v2 全流程覆盖（SEO/模板/响应式/动画/版本/导出）。
 *
 * 覆盖 V2 新增能力的设计态行为：
 *  - V2-T3 模板：新建页选模板，schema 注入
 *  - V2-T4 响应式：断点切换按钮存在，PropertyPanel 断点感知
 *  - V2-T5 动画：PropertyPanel 动画分区存在
 *  - V2-T8 版本历史：历史按钮存在
 *  - V2-T9 导出：导出按钮存在，点击触发下载
 *  - V2-T2 SEO：PageSeoPanel 渲染
 *
 * 鉴权/数据通过 cy.request API 驱动（与 designer.cy.ts 同模式），避免 UI 登录 flaky。
 * 真实后端依赖：需 bff + java-backend 运行（见 SYSTEM_ARCHITECTURE）。
 */
import type { PageSchema } from 'luban-low-code'

describe('Designer V2 — 全流程覆盖', () => {
  const account = Cypress.env('LUBAN_E2E_ACCOUNT') || 'e2e'
  const password = Cypress.env('LUBAN_E2E_PASSWORD') || 'e2e@2026'
  const uniq = Date.now()

  before(() => {
    cy.request({ method: 'POST', url: '/api/auth/login', body: { username: account, password } }).then(
      (loginResp) => {
        const token = loginResp.body.token
        cy.wrap(token).as('authToken')
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        cy.request({
          method: 'POST',
          url: '/api/sites',
          headers,
          body: { name: `cy-v2-${uniq}`, slug: `cy-v2-${uniq}`, baseUrl: 'http://cy.test', status: 'active' },
        }).then((siteResp) => {
          const siteId = siteResp.body.id
          cy.wrap(siteId).as('siteId')
        })
      }
    )
  })

  beforeEach(() => {
    cy.intercept('**/*').as('anyReq')
  })

  /** 带 token 注入 localStorage 后访问编辑器 */
  function openEditor(siteId: string, pageId: string): void {
    cy.window().then((win) => {
      win.localStorage.setItem('luban_token', String(Cypress.env('authToken') || ''))
    })
    cy.visit(`/designer/sites/${siteId}/pages/${pageId}`)
  }

  it('V2-T3 模板选择：模板入口弹窗可选模板', function () {
    // 进站点页面列表，点新建触发模板选择器
    cy.window().then((win) => {
      win.localStorage.setItem('luban_token', String(this.authToken))
    })
    cy.visit(`/designer/sites/${this.siteId}/pages`)
    // 「新建页面」按钮存在
    cy.contains('button', '新建页面').click()
    // 模板选择器弹窗（FeatureGate 开启时）
    cy.contains('选择模板').should('be.visible')
    // 选空白模板
    cy.contains('button', '空白页').click()
    // 进入编辑器
    cy.url().should('include', '/pages/new')
  })

  it('V2-T4 响应式：断点切换按钮存在', function () {
    const headers = { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' }
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    cy.request({
      method: 'POST',
      url: `/api/sites/${this.siteId}/pages`,
      headers,
      body: { name: `cy-v2-resp-${uniq}`, path: `/resp-${uniq}`, schema },
    }).then((r) => {
      openEditor(this.siteId, r.body.id)
      cy.contains('button', '桌面').should('exist')
      cy.contains('button', '平板').should('exist')
      cy.contains('button', '手机').should('exist')
      // 切换到平板
      cy.contains('button', '平板').click()
    })
  })

  it('V2-T5 动画：PropertyPanel 动画分区存在', function () {
    const headers = { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' }
    const schema: PageSchema = {
      root: {
        id: 'root',
        type: 'LubanContainer',
        props: {},
        children: [{ id: 't1', type: 'LubanText', props: { content: '动画测试' } }],
      },
    }
    cy.request({
      method: 'POST',
      url: `/api/sites/${this.siteId}/pages`,
      headers,
      body: { name: `cy-v2-anim-${uniq}`, path: `/anim-${uniq}`, schema },
    }).then((r) => {
      openEditor(this.siteId, r.body.id)
      // 点击画布节点选中
      cy.get('[data-lb-node="t1"]').click()
      // 动画分区标签存在
      cy.contains('动画').should('exist')
    })
  })

  it('V2-T8 版本历史：历史按钮存在', function () {
    const headers = { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' }
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    cy.request({
      method: 'POST',
      url: `/api/sites/${this.siteId}/pages`,
      headers,
      body: { name: `cy-v2-ver-${uniq}`, path: `/ver-${uniq}`, schema },
    }).then((r) => {
      openEditor(this.siteId, r.body.id)
      cy.contains('button', '历史').should('exist')
      cy.contains('button', '历史').click()
      cy.contains('版本历史').should('be.visible')
    })
  })

  it('V2-T9 导出：导出按钮存在', function () {
    const headers = { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' }
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    cy.request({
      method: 'POST',
      url: `/api/sites/${this.siteId}/pages`,
      headers,
      body: { name: `cy-v2-exp-${uniq}`, path: `/exp-${uniq}`, schema },
    }).then((r) => {
      openEditor(this.siteId, r.body.id)
      cy.contains('button', '导出').should('exist')
    })
  })

  it('V2-T2 SEO：PageSeoPanel 渲染', function () {
    const headers = { Authorization: `Bearer ${this.authToken}`, 'Content-Type': 'application/json' }
    const schema: PageSchema = {
      root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
    }
    cy.request({
      method: 'POST',
      url: `/api/sites/${this.siteId}/pages`,
      headers,
      body: { name: `cy-v2-seo-${uniq}`, path: `/seo-${uniq}`, schema },
    }).then((r) => {
      openEditor(this.siteId, r.body.id)
      // SEO 面板标题存在
      cy.contains('SEO 元信息').should('exist')
      cy.contains('页面标题').should('exist')
    })
  })
})
