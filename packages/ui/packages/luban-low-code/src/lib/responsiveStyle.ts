/**
 * V2-T4 响应式 CSS 输出：把节点的三断点 style 转为 @media CSS 字符串。
 *
 * 用途：RuntimeRenderer（website SSR）注入全局 <style>，按视口自动应用断点样式。
 * 设计态 DesignRenderer 直接用 resolveResponsiveProps 取当前断点 style（无需 @media）。
 *
 * 命名空间：每节点用唯一 data-lb-node="<id>" 选择器隔离，避免全局污染。
 *
 * 输出示例（node id=n1，tablet 改了 fontSize，mobile 改了 display）：
 *   @media (max-width: 1024px) { [data-lb-node="n1"] { font-size: 14px; } }
 *   @media (max-width: 768px)  { [data-lb-node="n1"] { font-size: 12px; display: none; } }
 */
import type { NodeSchema } from './schema';
import { BREAKPOINTS } from './responsive';

/** CSS 属性名 → JS camelCase 转换（fontSize → font-size）。 */
function toKebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/** 把 style 对象序列化为 CSS 声明块（不含大括号）。 */
function styleToDecls(style: Record<string, string>): string {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${toKebab(k)}: ${v};`)
    .join(' ');
}

/**
 * 生成单节点的响应式 @media CSS（仅含 tablet/mobile 覆盖部分）。
 * desktop 样式由内联 :style 直接应用，不输出到 @media。
 * 节点无响应式覆盖时返回空串。
 */
export function nodeResponsiveCss(node: NodeSchema): string {
  if (!node.responsive) return '';
  const selector = `[data-lb-node="${node.id}"]`;
  const rules: string[] = [];
  const tablet = node.responsive.tablet;
  if (tablet && Object.keys(tablet).length > 0) {
    const decls = styleToDecls(tablet);
    if (decls) rules.push(`@media (max-width: ${BREAKPOINTS.tablet}px) { ${selector} { ${decls} } }`);
  }
  const mobile = node.responsive.mobile;
  if (mobile && Object.keys(mobile).length > 0) {
    const decls = styleToDecls(mobile);
    if (decls) rules.push(`@media (max-width: ${BREAKPOINTS.mobile}px) { ${selector} { ${decls} } }`);
  }
  return rules.join('\n');
}

/**
 * 遍历 schema 树，收集所有节点的响应式 @media CSS，合并为一段 <style> 文本。
 * RuntimeRenderer 用此注入全局样式（website SSR 输出到 <head>）。
 * 仅含响应式覆盖；desktop 内联样式不在此输出。
 */
export function treeResponsiveCss(root: NodeSchema): string {
  const parts: string[] = [];
  function walk(node: NodeSchema): void {
    const css = nodeResponsiveCss(node);
    if (css) parts.push(css);
    if (node.children) {
      for (const c of node.children) walk(c);
    }
  }
  walk(root);
  return parts.join('\n');
}
