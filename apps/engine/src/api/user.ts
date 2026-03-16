import { request } from './request'

export interface User {
  id: string
  username: string
  name?: string
  role?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserCreatePayload {
  username: string
  password: string
  name?: string
  role?: string
}

export interface UserUpdatePayload {
  username?: string
  name?: string
  role?: string
  status?: string
  password?: string
}

export function getUsers(params?: { page?: number; size?: number; keyword?: string }) {
  return request.get<{ list: User[]; total: number }>('/users', { params })
}

export function getUser(id: string) {
  return request.get<User>(`/users/${id}`)
}

export function createUser(data: UserCreatePayload) {
  return request.post<User>('/users', data)
}

export function updateUser(id: string, data: UserUpdatePayload) {
  return request.put<User>(`/users/${id}`, data)
}

export function setUserStatus(id: string, status: string) {
  return request.patch<User>(`/users/${id}/status`, { status })
}
