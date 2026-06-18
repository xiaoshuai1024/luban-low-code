import { request } from './request'

export interface FormResponse {
  id: string
  siteId: string
  pageId: string
  name: string
  fieldSchema: Record<string, unknown>
  submitConfig: Record<string, unknown>
  dedupKeys?: string[]
  dedupWindow?: number
  dedupPolicy?: string
  antiSpam?: Record<string, unknown>
  status: string
  createdAt: string
  updatedAt: string
}

export interface FormSavePayload {
  siteId: string
  pageId?: string
  name: string
  fieldSchema: Record<string, unknown>
  submitConfig: Record<string, unknown>
  dedupKeys?: string[]
  dedupWindow?: number
  dedupPolicy?: string
  antiSpam?: Record<string, unknown>
  status?: string
}

export function getForms(siteId: string) {
  return request.get<FormResponse[]>('/forms', { params: { siteId } })
}

export function getForm(siteId: string, id: string) {
  return request.get<FormResponse>(`/forms/${id}`, { params: { siteId } })
}

export function createForm(data: FormSavePayload) {
  return request.post<FormResponse>('/forms', data)
}

export function updateForm(siteId: string, id: string, data: Partial<FormSavePayload>) {
  return request.patch<FormResponse>(`/forms/${id}`, data, { params: { siteId } })
}
