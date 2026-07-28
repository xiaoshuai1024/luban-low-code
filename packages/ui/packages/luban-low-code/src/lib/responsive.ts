/**
 * V2-T4 响应式断点定义与样式合并。
 *
 * resolveResponsiveProps：按当前断点折叠 style，返回该断点应生效的 CSS 属性。
 * 折叠规则（浅合并，非深合并）：
 *   desktop = node.style（默认）
 *   tablet  = { ...desktop, ...node.responsive?.tablet }
 *   mobile  = { ...tablet,  ...node.responsive?.mobile }
 *
 * 设计态：PageEditor 切断点 → DesignRenderer 接收 breakpoint → 调本函数取该断点 style。
 * 运行态：RuntimeRenderer 不切单断点，而是 toResponsiveCss 输出三断点 @media。
 */
import type { NodeSchema, NodeResponsive, ResponsiveBreakpoint } from './schema';

/** 断点像素宽度（max-width 触发，mobile < 768 < tablet < 1024） */
export const BREAKPOINTS = {
  tablet: 1024,
  mobile: 768,
} as const;

/**
 * 按断点折叠节点 style，返回该断点应生效的 CSS 属性对象。
 * desktop 为基础；tablet/mobile 依次浅合并覆盖。
 */
export function resolveResponsiveProps(
  node: NodeSchema,
  breakpoint: ResponsiveBreakpoint
): Record<string, string> {
  const desktop = { ...(node.style ?? {}) };
  if (breakpoint === 'desktop') return desktop;
  const responsive: NodeResponsive = node.responsive ?? {};
  if (breakpoint === 'tablet') {
    return { ...desktop, ...(responsive.tablet ?? {}) };
  }
  // mobile：先合并 tablet 再合并 mobile
  return {
    ...desktop,
    ...(responsive.tablet ?? {}),
    ...(responsive.mobile ?? {}),
  };
}

/** 判断节点是否有任意响应式覆盖（决定是否输出 @media CSS）。 */
export function hasResponsiveOverrides(node: NodeSchema): boolean {
  const r = node.responsive;
  if (!r) return false;
  const t = r.tablet ? Object.keys(r.tablet).length : 0;
  const m = r.mobile ? Object.keys(r.mobile).length : 0;
  return t + m > 0;
}
