import { request } from './request'

/**
 * V2-T7 Collection CMS API 客户端（engine 消费侧）。
 * 与后端契约一致：GET/POST /collections?siteId=, GET/PUT/DELETE /collections/:id?siteId=,
 *   GET/POST /collections/:id/items?siteId=, GET/PUT/DELETE /collections/:id/items/:itemId?siteId=
 */
export interface CollectionResponse {
  id: string
  siteId: string
  name: string
  fieldSchema?: Record<string, unknown>
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface CollectionItemResponse {
  id: string
  collectionId: string
  data?: Record<string, unknown>
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface CollectionSavePayload {
  name: string
  fieldSchema?: Record<string, unknown>
  status?: string
}

export interface CollectionItemSavePayload {
  data: Record<string, unknown>
  status?: string
}

// === Collection ===

export function getCollections(siteId: string) {
  return request.get<CollectionResponse[]>('/collections', { params: { siteId } })
}

export function getCollection(siteId: string, id: string) {
  return request.get<CollectionResponse>(`/collections/${id}`, { params: { siteId } })
}

export function createCollection(siteId: string, data: CollectionSavePayload) {
  return request.post<CollectionResponse>('/collections', data, { params: { siteId } })
}

export function updateCollection(siteId: string, id: string, data: CollectionSavePayload) {
  return request.put<CollectionResponse>(`/collections/${id}`, data, { params: { siteId } })
}

export function deleteCollection(siteId: string, id: string) {
  return request.delete(`/collections/${id}`, { params: { siteId } })
}

// === CollectionItem ===

export function getCollectionItems(siteId: string, collectionId: string) {
  return request.get<CollectionItemResponse[]>(`/collections/${collectionId}/items`, {
    params: { siteId },
  })
}

export function createCollectionItem(
  siteId: string,
  collectionId: string,
  data: CollectionItemSavePayload
) {
  return request.post<CollectionItemResponse>(`/collections/${collectionId}/items`, data, {
    params: { siteId },
  })
}

export function updateCollectionItem(
  siteId: string,
  collectionId: string,
  itemId: string,
  data: CollectionItemSavePayload
) {
  return request.put<CollectionItemResponse>(
    `/collections/${collectionId}/items/${itemId}`,
    data,
    { params: { siteId } }
  )
}

export function deleteCollectionItem(siteId: string, collectionId: string, itemId: string) {
  return request.delete(`/collections/${collectionId}/items/${itemId}`, { params: { siteId } })
}
