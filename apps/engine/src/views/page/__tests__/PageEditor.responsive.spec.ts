/**
 * PageEditor.responsive.spec.ts — V2-T4 响应式断点集成测试（engine 消费侧）。
 *
 * 验证 engine 通过 luban-low-code 导入的响应式 API 行为一致：
 *  - resolveResponsiveProps 三断点折叠
 *  - treeResponsiveCss 输出 @media CSS（website SSR 消费）
 *  - ResponsiveBreakpoint 类型从 @/types/schema 可用
 *
 * 注：纯逻辑测试，不 mount 组件（避免 element-plus 复杂 stub）。
 */
import { describe, it, expect } from 'vitest'
import {
  resolveResponsiveProps,
  treeResponsiveCss,
  BREAKPOINTS,
} from 'luban-low-code'
import type { NodeSchema, ResponsiveBreakpoint } from '@/types/schema'

describe('V2-T4 responsive cross-cutting (engine consumer)', () => {
  const node: NodeSchema = {
    id: 'hero-1',
    type: 'LubanHero',
    style: { padding: '40px', fontSize: '32px' },
    responsive: {
      tablet: { padding: '24px', fontSize: '24px' },
      mobile: { padding: '16px', fontSize: '18px', display: 'block' },
    },
  }

  it('desktop 返回 node.style 基础', () => {
    const s = resolveResponsiveProps(node, 'desktop')
    expect(s.padding).toBe('40px')
    expect(s.fontSize).toBe('32px')
  })

  it('tablet 浅合并 desktop + tablet 覆盖', () => {
    const s = resolveResponsiveProps(node, 'tablet')
    expect(s.padding).toBe('24px')
    expect(s.fontSize).toBe('24px')
  })

  it('mobile 合并 desktop+tablet+mobile', () => {
    const s = resolveResponsiveProps(node, 'mobile')
    expect(s.padding).toBe('16px')
    expect(s.fontSize).toBe('18px')
    expect(s.display).toBe('block')
  })

  it('treeResponsiveCss 输出 tablet + mobile @media', () => {
    const root: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [node],
    }
    const css = treeResponsiveCss(root)
    expect(css).toContain(`@media (max-width: ${BREAKPOINTS.tablet}px)`)
    expect(css).toContain(`@media (max-width: ${BREAKPOINTS.mobile}px)`)
    expect(css).toContain('[data-lb-node="hero-1"]')
    expect(css).toContain('padding: 24px')
    expect(css).toContain('font-size: 18px')
  })

  it('ResponsiveBreakpoint 类型可用（desktop/tablet/mobile）', () => {
    const bps: ResponsiveBreakpoint[] = ['desktop', 'tablet', 'mobile']
    expect(bps).toHaveLength(3)
  })

  it('无 responsive 的节点 treeResponsiveCss 输出空串', () => {
    const plain: NodeSchema = {
      id: 'root',
      type: 'LubanContainer',
      children: [{ id: 't', type: 'LubanText', style: { color: 'red' } }],
    }
    expect(treeResponsiveCss(plain)).toBe('')
  })
})
