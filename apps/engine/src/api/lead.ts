import { request } from './request'

export interface LeadResponse {
  id: string
  siteId: string
  formId: string
  formName?: string
  pageId: string
  channelId?: string
  contactMasked: Record<string, string>
  utm?: Record<string, string>
  status: string
  assigneeId?: string
  sourceIp?: string
  createdAt: string
  updatedAt: string
  convertedAt?: string
}

export interface LeadListParams {
  siteId: string
  status?: string
  formId?: string
  assigneeId?: string
  page?: number
  size?: number
}

export interface LeadStatusUpdatePayload {
  status: string
  assigneeId?: string
}

export function getLeads(params: LeadListParams) {
  return request.get<{ list: LeadResponse[]; total: number }>('/leads', { params })
}

export function getLead(siteId: string, id: string) {
  return request.get<LeadResponse>(`/leads/${id}`, { params: { siteId } })
}

export function updateLeadStatus(siteId: string, id: string, data: LeadStatusUpdatePayload) {
  return request.patch<LeadResponse>(`/leads/${id}/status`, data, { params: { siteId } })
}

export function exportLeadsCsv(siteId: string) {
  return request.get<string>(`/leads/export`, {
    params: { siteId },
    responseType: 'blob',
  })
}

/** 线索状态映射 */
export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: '新线索',
  assigned: '已分配',
  contacting: '联系中',
  converted: '已转化',
  lost: '已流失',
  invalid: '无效',
}

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'info',
  assigned: 'primary',
  contacting: 'warning',
  converted: 'success',
  lost: 'danger',
  invalid: '',
}

/** 可用的状态变更目标 */
export const LEAD_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['assigned', 'invalid'],
  assigned: ['contacting', 'invalid', 'lost'],
  contacting: ['converted', 'lost', 'invalid'],
  converted: [],
  lost: [],
  invalid: [],
}
