import { describe, expect, it } from 'vitest'
import { buildPublishedPagePreviewUrl } from './publicPage'

describe('buildPublishedPagePreviewUrl', () => {
  it('builds URL from baseUrl when valid', () => {
    const url = buildPublishedPagePreviewUrl({
      baseUrl: 'https://demo.luban.com',
      path: '/home',
    })
    expect(url).toBe('https://demo.luban.com/home')
  })

  it('normalizes path without leading slash', () => {
    const url = buildPublishedPagePreviewUrl({
      baseUrl: 'https://demo.luban.com',
      path: 'landing',
    })
    expect(url).toBe('https://demo.luban.com/landing')
  })

  it('falls back to public api route by slug', () => {
    const url = buildPublishedPagePreviewUrl({
      slug: 'website',
      path: '/about',
    })
    expect(url).toBe('/api/public/sites/website/pages?path=%2Fabout')
  })

  it('returns null when both baseUrl and slug are missing', () => {
    const url = buildPublishedPagePreviewUrl({ path: '/home' })
    expect(url).toBeNull()
  })
})
