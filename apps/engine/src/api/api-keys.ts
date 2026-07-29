import { request } from './request'

export interface ApiKey {
  id: string
  name: string
  prefix: string
  key?: string
  status: 'active' | 'revoked'
  lastUsedAt?: string
  expiresAt?: string
  createdAt: string
}

export interface CreateApiKeyPayload {
  name: string
  expiresAt?: string
}

export function listApiKeys() {
  return request.get<{ list: ApiKey[]; total: number }>('/api-keys')
}

export function createApiKey(data: CreateApiKeyPayload) {
  return request.post<ApiKey>('/api-keys', data)
}

export function revokeApiKey(id: string) {
  return request.patch<ApiKey>(`/api-keys/${id}/revoke`)
}
