/**
 * V2-T5 动画 CSS 生成。
 *
 * buildAnimationCss：把 NodeAnimation 转为 @keyframes + 选择器规则。
 * 触发机制：
 *  - load：页面加载即播放（animation 直接生效）
 *  - hover：hover 时播放（选择器 :hover）
 *  - in-view：进入视口时播放（由 animationObserver.ts 的 IntersectionObserver
 *    给元素加 .lb-anim--playing class 触发；CSS 初始隐藏）
 *
 * 用 data-lb-node="<id>" 选择器隔离节点。
 * 无 animation 或 type 缺省时返回空串（零开销）。
 *
 * 设计原则：纯函数，可绕 DOM 单测。
 */
import type { NodeAnimation, AnimationType } from './schema';

/** 动画类型 → @keyframes 定义（初始态 + 终态）。 */
const KEYFRAMES: Record<AnimationType, string> = {
  fade: `
@keyframes lb-anim-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}`,
  'slide-up': `
@keyframes lb-anim-slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}`,
  'slide-left': `
@keyframes lb-anim-slide-left {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}`,
  zoom: `
@keyframes lb-anim-zoom {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}`,
  flip: `
@keyframes lb-anim-flip {
  from { opacity: 0; transform: perspective(400px) rotateY(90deg); }
  to { opacity: 1; transform: perspective(400px) rotateY(0); }
}`,
};

/** animation-name 映射（type → keyframes name） */
function animName(type: AnimationType): string {
  return `lb-anim-${type}`;
}

/** 是否为有效动画配置（type 必填才算） */
export function isValidAnimation(anim: NodeAnimation | undefined): anim is NodeAnimation {
  if (!anim) return false;
  if (!anim.type) return false;
  return !!KEYFRAMES[anim.type];
}

/**
 * 生成单节点的动画 CSS。
 * 返回 @keyframes 定义 + 选择器规则（按 trigger 分支）。
 * 无效动画返回空串。
 */
export function buildAnimationCss(nodeId: string, anim: NodeAnimation | undefined): string {
  if (!isValidAnimation(anim)) return '';
  const type = anim.type!;
  const duration = anim.duration ?? 600;
  const delay = anim.delay ?? 0;
  const easing = anim.easing ?? 'ease-out';
  const trigger = anim.trigger ?? 'load';
  const selector = `[data-lb-node="${nodeId}"]`;
  const kf = KEYFRAMES[type];
  const animProps = `${animName(type)} ${duration}ms ${easing} ${delay}ms both`;

  if (trigger === 'load') {
    return `${kf}\n${selector} { animation: ${animProps}; }`;
  }
  if (trigger === 'hover') {
    // hover 时播放：默认无动画，hover 触发
    return `${kf}\n${selector}:hover { animation: ${animProps}; }`;
  }
  // in-view：初始隐藏（opacity:0），进入视口加 .lb-anim--playing 触发动画
  return `${kf}
${selector}.lb-anim-pending { opacity: 0; }
${selector}.lb-anim-playing { animation: ${animProps}; }`;
}

/**
 * 遍历整树收集所有节点的动画 CSS，合并为一段 <style>。
 * 仅含有效动画节点；@keyframes 按类型去重（同类型只输出一次）。
 */
export function treeAnimationCss(root: { id?: string; animation?: NodeAnimation; children?: unknown[] }): string {
  const parts: string[] = [];
  const seenKeyframes = new Set<AnimationType>();
  function walk(node: { id?: string; animation?: NodeAnimation; children?: unknown[] }): void {
    if (node.id && node.animation) {
      const css = buildAnimationCss(node.id, node.animation);
      if (css) {
        // 去重 @keyframes：同类型只保留第一次出现的定义
        let filtered = css;
        const type = node.animation.type;
        if (type) {
          if (seenKeyframes.has(type)) {
            // 移除已存在的 @keyframes 块（保留选择器规则）
            filtered = css.replace(KEYFRAMES[type].trim(), '').replace(/^\s+/, '');
          } else {
            seenKeyframes.add(type);
          }
        }
        if (filtered.trim()) parts.push(filtered);
      }
    }
    if (node.children) {
      for (const c of node.children) walk(c as { id?: string; animation?: NodeAnimation; children?: unknown[] });
    }
  }
  walk(root);
  return parts.join('\n');
}
