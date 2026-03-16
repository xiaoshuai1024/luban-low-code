import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { LoginPayload, LoginResult } from '@/api/auth'
import type { Site } from '@/api/site'
import type { PageMeta } from '@/api/page'
import type { User, UserCreatePayload, UserUpdatePayload } from '@/api/user'
import type { SystemSettings } from '@/api/settings'
import type { PageSchema } from '@/types/schema'

interface MockContext {
  sites: Site[]
  pages: PageMeta[]
  users: User[]
  settings: SystemSettings
}

// 简单的内存假数据，页面刷新后会重置
const mockContext: MockContext = {
  sites: [
    {
      id: 'site-1',
      name: '示例站点mock',
      slug: 'site-a',
      baseUrl: 'https://example-a.com',
      status: 'active',
      createdAt: '2025-01-01 10:00:00',
      updatedAt: '2025-01-10 12:00:00',
    },
    {
      id: 'site-2',
      name: '示例站点 B',
      slug: 'site-b',
      baseUrl: 'https://example-b.com',
      status: 'inactive',
      createdAt: '2025-02-01 09:00:00',
      updatedAt: '2025-02-05 18:30:00',
    },
  ],
  pages: [],
  users: [
    {
      id: 'user-1',
      username: 'admin',
      name: '管理员',
      role: 'admin',
      status: 'active',
      createdAt: '2025-01-01 08:00:00',
      updatedAt: '2025-01-01 08:00:00',
    },
    {
      id: 'user-2',
      username: 'user',
      name: '普通用户',
      role: 'user',
      status: 'active',
      createdAt: '2025-01-02 09:30:00',
      updatedAt: '2025-01-02 09:30:00',
    },
  ],
  settings: {
    siteName: 'Luban 管理后台 (Mock)',
    logo: '',
    security: { sessionTimeout: 30 },
    notification: { enabled: true },
  },
}

const mockPasswords: Record<string, string> = {
  admin: '123456',
  user: '123456',
}

const MOCK_TOKEN = 'mock-token'

function createResponse<T>(config: AxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  }
}

function unauthorized(config: AxiosRequestConfig): AxiosResponse {
  return createResponse(
    config,
    { message: 'Unauthorized' } as unknown as Record<string, unknown>,
    401
  )
}

function requireAuth(config: AxiosRequestConfig): AxiosResponse | null {
  const auth = (config.headers?.Authorization ||
    (config.headers as Record<string, unknown>)?.authorization) as string | undefined
  if (!auth || !auth.startsWith('Bearer ')) {
    return unauthorized(config)
  }
  const token = auth.slice('Bearer '.length)
  if (token !== MOCK_TOKEN) {
    return unauthorized(config)
  }
  return null
}

function handleAuth(config: AxiosRequestConfig): AxiosResponse | null {
  const url = config.url ?? ''
  const method = (config.method ?? 'get').toLowerCase()

  if (url === '/auth/login' && method === 'post') {
    const payload = (config.data ?? {}) as LoginPayload
    const password = mockPasswords[payload.username]
    if (!password || password !== payload.password) {
      return createResponse(
        config,
        { message: '账号或密码错误' } as unknown as Record<string, unknown>,
        401
      )
    }
    const user = mockContext.users.find((u) => u.username === payload.username)
    const result: LoginResult = {
      token: MOCK_TOKEN,
      user: user
        ? { id: user.id, username: user.username, name: user.name }
        : { id: 'user-unknown', username: payload.username },
    }
    return createResponse(config, result)
  }

  if (url === '/auth/me' && method === 'get') {
    const authError = requireAuth(config)
    if (authError) return authError
    const user = mockContext.users[0]
    return createResponse(config, {
      id: user.id,
      username: user.username,
      name: user.name,
    })
  }

  return null
}

function handleSites(config: AxiosRequestConfig): AxiosResponse | null {
  const url = config.url ?? ''
  const method = (config.method ?? 'get').toLowerCase()

  if (url === '/sites' && method === 'get') {
    const authError = requireAuth(config)
    if (authError) return authError
    return createResponse(config, [...mockContext.sites])
  }

  if (url === '/sites' && method === 'post') {
    const authError = requireAuth(config)
    if (authError) return authError
    const body = (config.data ?? {}) as Omit<Site, 'id' | 'createdAt' | 'updatedAt'>
    const now = new Date().toISOString()
    const site: Site = {
      id: `site-${mockContext.sites.length + 1}`,
      name: body.name,
      slug: body.slug,
      baseUrl: body.baseUrl,
      status: body.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    }
    mockContext.sites.push(site)
    return createResponse(config, site)
  }

  const matchId = url.match(/^\/sites\/([^/]+)$/)
  if (matchId) {
    const authError = requireAuth(config)
    if (authError) return authError
    const id = matchId[1]
    const index = mockContext.sites.findIndex((s) => s.id === id)
    if (index === -1) {
      return createResponse(
        config,
        { message: 'Site not found' } as unknown as Record<string, unknown>,
        404
      )
    }
    if (method === 'get') {
      return createResponse(config, mockContext.sites[index])
    }
    if (method === 'put') {
      const body = (config.data ?? {}) as Partial<Site>
      mockContext.sites[index] = {
        ...mockContext.sites[index],
        ...body,
        updatedAt: new Date().toISOString(),
      }
      return createResponse(config, mockContext.sites[index])
    }
    if (method === 'delete') {
      mockContext.sites.splice(index, 1)
      // 同时删除相关页面
      mockContext.pages = mockContext.pages.filter((p) => p.siteId !== id)
      return createResponse(config, {} as Record<string, unknown>)
    }
  }

  return null
}

function handlePages(config: AxiosRequestConfig): AxiosResponse | null {
  const url = config.url ?? ''
  const method = (config.method ?? 'get').toLowerCase()
  const matchList = url.match(/^\/sites\/([^/]+)\/pages$/)
  const matchDetail = url.match(/^\/sites\/([^/]+)\/pages\/([^/]+)$/)

  if (matchList) {
    const authError = requireAuth(config)
    if (authError) return authError
    const siteId = matchList[1]
    const list = mockContext.pages.filter((p) => p.siteId === siteId)
    return createResponse(config, [...list])
  }

  if (matchDetail) {
    const authError = requireAuth(config)
    if (authError) return authError
    const siteId = matchDetail[1]
    const pageId = matchDetail[2]
    const index = mockContext.pages.findIndex((p) => p.siteId === siteId && p.id === pageId)
    if (index === -1) {
      return createResponse(
        config,
        { message: 'Page not found' } as unknown as Record<string, unknown>,
        404
      )
    }
    if (method === 'get') {
      return createResponse(config, mockContext.pages[index])
    }
    if (method === 'put') {
      const body = (config.data ?? {}) as {
        name?: string
        path?: string
        schema?: PageSchema
      }
      mockContext.pages[index] = {
        ...mockContext.pages[index],
        ...body,
        updatedAt: new Date().toISOString(),
      }
      return createResponse(config, mockContext.pages[index])
    }
    if (method === 'delete') {
      mockContext.pages.splice(index, 1)
      return createResponse(config, {} as Record<string, unknown>)
    }
  }

  if (matchList && method === 'post') {
    const authError = requireAuth(config)
    if (authError) return authError
    const siteId = matchList[1]
    const body = (config.data ?? {}) as {
      name: string
      path: string
      schema?: PageSchema
    }
    const now = new Date().toISOString()
    const page: PageMeta = {
      id: `page-${mockContext.pages.length + 1}`,
      siteId,
      name: body.name,
      path: body.path,
      status: 'draft',
      schema:
        body.schema ??
        ({
          root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
        } as PageSchema),
      createdAt: now,
      updatedAt: now,
    }
    mockContext.pages.push(page)
    return createResponse(config, page)
  }

  return null
}

function handleUsers(config: AxiosRequestConfig): AxiosResponse | null {
  const url = config.url ?? ''
  const method = (config.method ?? 'get').toLowerCase()

  if (url === '/users' && method === 'get') {
    const authError = requireAuth(config)
    if (authError) return authError
    const params = (config.params ?? {}) as { page?: number; size?: number; keyword?: string }
    const page = params.page ?? 1
    const size = params.size ?? 10
    const keyword = (params.keyword ?? '').toString().trim().toLowerCase()

    let filtered = [...mockContext.users]
    if (keyword) {
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(keyword) ||
          (u.name ?? '').toLowerCase().includes(keyword)
      )
    }
    const start = (page - 1) * size
    const end = start + size
    const list = filtered.slice(start, end)
    return createResponse(config, { list, total: filtered.length })
  }

  if (url === '/users' && method === 'post') {
    const authError = requireAuth(config)
    if (authError) return authError
    const payload = (config.data ?? {}) as UserCreatePayload
    const now = new Date().toISOString()
    const user: User = {
      id: `user-${mockContext.users.length + 1}`,
      username: payload.username,
      name: payload.name,
      role: payload.role ?? 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    mockContext.users.push(user)
    mockPasswords[payload.username] = payload.password
    return createResponse(config, user)
  }

  const matchUser = url.match(/^\/users\/([^/]+)$/)
  if (matchUser) {
    const authError = requireAuth(config)
    if (authError) return authError
    const id = matchUser[1]
    const index = mockContext.users.findIndex((u) => u.id === id)
    if (index === -1) {
      return createResponse(
        config,
        { message: 'User not found' } as unknown as Record<string, unknown>,
        404
      )
    }
    if (method === 'get') {
      return createResponse(config, mockContext.users[index])
    }
    if (method === 'put') {
      const body = (config.data ?? {}) as UserUpdatePayload
      mockContext.users[index] = {
        ...mockContext.users[index],
        ...body,
        updatedAt: new Date().toISOString(),
      }
      if (body.password && mockContext.users[index].username) {
        mockPasswords[mockContext.users[index].username] = body.password
      }
      return createResponse(config, mockContext.users[index])
    }
  }

  const matchStatus = url.match(/^\/users\/([^/]+)\/status$/)
  if (matchStatus && method === 'patch') {
    const authError = requireAuth(config)
    if (authError) return authError
    const id = matchStatus[1]
    const index = mockContext.users.findIndex((u) => u.id === id)
    if (index === -1) {
      return createResponse(
        config,
        { message: 'User not found' } as unknown as Record<string, unknown>,
        404
      )
    }
    const body = (config.data ?? {}) as { status?: string }
    mockContext.users[index].status = body.status ?? mockContext.users[index].status
    mockContext.users[index].updatedAt = new Date().toISOString()
    return createResponse(config, mockContext.users[index])
  }

  return null
}

function handleSettings(config: AxiosRequestConfig): AxiosResponse | null {
  const url = config.url ?? ''
  const method = (config.method ?? 'get').toLowerCase()

  if (url === '/settings' && method === 'get') {
    const authError = requireAuth(config)
    if (authError) return authError
    return createResponse(config, { ...mockContext.settings })
  }

  if (url === '/settings' && method === 'put') {
    const authError = requireAuth(config)
    if (authError) return authError
    const body = (config.data ?? {}) as Partial<SystemSettings>
    mockContext.settings = {
      ...mockContext.settings,
      ...body,
      security: {
        ...mockContext.settings.security,
        ...(body.security ?? {}),
      },
      notification: {
        ...mockContext.settings.notification,
        ...(body.notification ?? {}),
      },
    }
    return createResponse(config, { ...mockContext.settings })
  }

  return null
}

export async function handleMockRequest(
  config: AxiosRequestConfig
): Promise<AxiosResponse | null> {
  const url = config.url ?? ''
  if (!url.startsWith('/auth') && !url.startsWith('/sites') && !url.startsWith('/users') && !url.startsWith('/settings')) {
    return null
  }

  const handlers = [handleAuth, handleSites, handlePages, handleUsers, handleSettings]
  for (const handler of handlers) {
    const res = handler(config)
    if (res) {
      return res
    }
  }
  return null
}

export function setupMock(instance: AxiosInstance): void {
  instance.interceptors.request.use(async (config) => {
    const mockResponse = await handleMockRequest(config)
    if (mockResponse) {
      const error: Error & { __isMock?: boolean; response?: AxiosResponse } = new Error('Mock')
      error.__isMock = true
      error.response = mockResponse
      return Promise.reject(error)
    }
    return config
  })
}

