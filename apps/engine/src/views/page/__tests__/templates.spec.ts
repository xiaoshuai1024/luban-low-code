/**
 * templates.spec.ts — V2-T3 模板定义单测。
 *
 * 验证：
 *  - TEMPLATES 数量达标（≥10）
 *  - 每个 template 有合法 id/name/category/schema
 *  - schema.root 非 null 且 type 为 LubanContainer
 *  - id 唯一
 *  - groupTemplatesByCategory 正确分组
 *  - getTemplate 按 id 返回
 */
import { describe, it, expect } from 'vitest'
import { TEMPLATES, groupTemplatesByCategory, getTemplate } from '@/config/templates'
import type { PageTemplate } from '@/config/templates'

describe('V2-T3 templates', () => {
  it('TEMPLATES 至少 10 个', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(10)
  })

  it('每个 template 有合法结构', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.category).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.thumbnail).toBeTruthy()
      expect(t.schema).toBeTruthy()
      expect(t.schema.root).toBeTruthy()
      expect(t.schema.root.type).toBe('LubanContainer')
    }
  })

  it('id 唯一', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('含空白模板', () => {
    const blank = getTemplate('blank')
    expect(blank).toBeTruthy()
    expect(blank!.category).toBe('blank')
    expect((blank!.schema.root.children ?? []).length).toBe(0)
  })

  it('含 SaaS / 电商 / 教育 / 落地页 多行业模板', () => {
    const categories = new Set(TEMPLATES.map((t) => t.category))
    expect(categories.has('saas')).toBe(true)
    expect(categories.has('ecommerce')).toBe(true)
    expect(categories.has('education')).toBe(true)
    expect(categories.has('landing')).toBe(true)
  })

  it('非空白模板至少含一个子节点', () => {
    const nonBlank = TEMPLATES.filter((t) => t.category !== 'blank')
    expect(nonBlank.length).toBeGreaterThan(0)
    for (const t of nonBlank) {
      expect((t.schema.root.children ?? []).length).toBeGreaterThan(0)
    }
  })

  it('groupTemplatesByCategory 返回非空分组', () => {
    const groups = groupTemplatesByCategory()
    expect(groups.length).toBeGreaterThan(0)
    const allTemplates = groups.flatMap((g) => g.templates)
    expect(allTemplates.length).toBe(TEMPLATES.length)
  })

  it('getTemplate 返回 undefined for 不存在 id', () => {
    expect(getTemplate('nonexistent-id')).toBeUndefined()
  })

  it('模板 schema 可深拷贝（避免 mutate 源）', () => {
    const original = TEMPLATES[1]
    const copy: PageTemplate = JSON.parse(JSON.stringify(original))
    expect(copy.schema.root).toBeTruthy()
    expect(copy.id).toBe(original.id)
    // 改 copy 不影响源
    copy.schema.root.id = 'modified'
    expect(TEMPLATES[1].schema.root.id).not.toBe('modified')
  })
})
