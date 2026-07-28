/**
 * V2-T5 动画 IntersectionObserver composable。
 *
 * useAnimationObserver：扫描容器内 [data-lb-node] 且 animation.trigger='in-view' 的节点，
 * 进入视口时加 .lb-anim-playing（触发 CSS 动画），离开时按 scrollRepeat 决定是否
 * 回退 .lb-anim-pending（重播）或保持播放态。
 *
 * 用法（RuntimeRenderer host 层，如 website DynamicPage / LubanPage）：
 *   const { observe } = useAnimationObserver(rootEl, schema);
 *   observe();  // 在 mounted/schema 变更后调用
 *
 * 无 IntersectionObserver 环境（SSR / 旧浏览器）降级为 noop（动画不触发，不报错）。
 */
import { onBeforeUnmount } from 'vue';
import type { NodeSchema, NodeAnimation } from './schema';

interface ObserveOptions {
  /** 视口阈值（0-1），默认 0.15（15% 可见即触发） */
  threshold?: number;
  /** 提前量（px），默认 0 */
  rootMargin?: string;
}

/**
 * 收集 schema 树中所有 trigger=in-view 的节点 {id, scrollRepeat}。
 */
export function collectInViewNodes(root: NodeSchema): { id: string; scrollRepeat?: boolean }[] {
  const out: { id: string; scrollRepeat?: boolean }[] = [];
  function walk(node: NodeSchema): void {
    const anim: NodeAnimation | undefined = node.animation;
    if (anim && anim.trigger === 'in-view' && anim.type) {
      out.push({ id: node.id, scrollRepeat: anim.scrollRepeat });
    }
    if (node.children) {
      for (const c of node.children) walk(c);
    }
  }
  walk(root);
  return out;
}

/**
 * 创建动画观察器。返回 { observe, disconnect }。
 * observe() 扫描容器内 in-view 节点并注册 IO；节点进入视口切 class 触发动画。
 */
export function useAnimationObserver(
  containerRef: () => HTMLElement | null,
  schemaRef: () => NodeSchema | null | undefined,
  options: ObserveOptions = {}
): { observe: () => void; disconnect: () => void } {
  let io: IntersectionObserver | null = null;
  const threshold = options.threshold ?? 0.15;
  const rootMargin = options.rootMargin ?? '0px';

  function disconnect(): void {
    if (io) {
      io.disconnect();
      io = null;
    }
  }

  function observe(): void {
    disconnect();
    const container = containerRef();
    const schema = schemaRef();
    if (!container || !schema) return;
    if (typeof IntersectionObserver === 'undefined') return; // SSR/旧浏览器降级

    const nodes = collectInViewNodes(schema);
    if (nodes.length === 0) return;

    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const nodeId = el.dataset.lbNode;
          if (!nodeId) continue;
          const nodeCfg = nodes.find((n) => n.id === nodeId);
          if (!nodeCfg) continue;

          if (entry.isIntersecting) {
            // 进入视口：pending → playing
            el.classList.remove('lb-anim-pending');
            el.classList.add('lb-anim-playing');
            if (!nodeCfg.scrollRepeat) {
              io?.unobserve(el); // 只播一次
            }
          } else if (nodeCfg.scrollRepeat) {
            // 离开视口且需重播：playing → pending
            el.classList.remove('lb-anim-playing');
            el.classList.add('lb-anim-pending');
          }
        }
      },
      { threshold, rootMargin }
    );

    // 初始标记 pending（隐藏）+ 注册观察
    for (const n of nodes) {
      const el = container.querySelector(`[data-lb-node="${n.id}"]`) as HTMLElement | null;
      if (el) {
        el.classList.add('lb-anim-pending');
        io.observe(el);
      }
    }
  }

  onBeforeUnmount(disconnect);

  return { observe, disconnect };
}
