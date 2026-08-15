/**
 * form.spec.ts — 表单 API 客户端单测（close-review-gaps 5.5/5.7）。
 *
 * mock @/api/request 的 axios 实例，验证 URL/参数契约（BFF forms/[id] route）：
 *  - getForms/getForm/createForm/updateForm 既有契约不回归
 *  - deleteForm：DELETE /forms/:id?siteId=（204；409 FORM_HAS_LEADS 由调用方分支处理）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/api/request', () => ({
  request: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { request } from '@/api/request'
import { getForms, getForm, createForm, updateForm, deleteForm } from '@/api/form'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('form api', () => {
  it('getForms → GET /forms?siteId=', () => {
    getForms('s1')
    expect(request.get).toHaveBeenCalledWith('/forms', { params: { siteId: 's1' } })
  })

  it('getForm → GET /forms/:id?siteId=', () => {
    getForm('s1', 'f1')
    expect(request.get).toHaveBeenCalledWith('/forms/f1', { params: { siteId: 's1' } })
  })

  it('createForm → POST /forms', () => {
    createForm({ siteId: 's1', name: '留资', fieldSchema: {}, submitConfig: {} })
    expect(request.post).toHaveBeenCalledWith('/forms', {
      siteId: 's1',
      name: '留资',
      fieldSchema: {},
      submitConfig: {},
    })
  })

  it('updateForm → PATCH /forms/:id?siteId=', () => {
    updateForm('s1', 'f1', { name: '改名' })
    expect(request.patch).toHaveBeenCalledWith('/forms/f1', { name: '改名' }, { params: { siteId: 's1' } })
  })

  it('deleteForm → DELETE /forms/:id?siteId=', () => {
    deleteForm('s1', 'f1')
    expect(request.delete).toHaveBeenCalledWith('/forms/f1', { params: { siteId: 's1' } })
  })
})
