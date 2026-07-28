/**
 * V2-T1 运行时主题 API。
 *
 * 原理：所有 luban 组件用 var(--lb-*) 消费样式；本模块在运行时改写 :root
 * 上的自定义属性，即可整站换肤，无需重建样式表。
 *
 * 对外：
 *   applyTheme(tokens)        覆盖部分 token（与当前值合并）
 *   applyThemePreset(name)    应用预设（先 reset 再覆盖，确保非覆盖键回默认）
 *   resetTheme()              清除所有运行时覆盖，回到 _variables.scss 默认
 *   getCurrentTheme()         读当前生效的 token 快照（含运行时覆盖）
 *   onThemeChange(cb)         订阅变更，返回取消订阅函数
 *
 * 实现细节：
 *   - 覆盖以 data-lb-theme-style 属性标记的 <style> 标签承载，不污染 :root
 *     原始声明（resetTheme 直接移除该标签即回默认）。
 *   - 浏览器与 jsdom 均可用（document.documentElement 必在）。
 *   - SSR 安全：若无 document，所有写操作降级为 noop；getCurrentTheme 返回 LIGHT_PRESET。
 */
import type { LubanThemeName, LubanThemeTokens, PartialThemeTokens } from './types';
import { LIGHT_PRESET, DARK_PRESET } from './presets';

const STYLE_TAG_ID = 'lb-theme-runtime-overrides';
const STYLE_ATTR = 'data-lb-theme-style';

/** 当前运行时覆盖的 token（仅含被显式 set 的键） */
let currentOverrides: PartialThemeTokens = {};
/** 当前激活的预设名（applyThemePreset 设置；applyTheme 不改写） */
let currentPreset: LubanThemeName | null = null;
const listeners = new Set<(tokens: LubanThemeTokens) => void>();

function isBrowser(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement;
}

/** 取或建承载运行时覆盖的 <style> 标签 */
function ensureStyleEl(): HTMLStyleElement | null {
  if (!isBrowser()) return null;
  let el = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_TAG_ID;
    el.setAttribute(STYLE_ATTR, 'true');
    document.head.appendChild(el);
  }
  return el;
}

/** 把覆盖 tokens 序列化为 :root { --lb-xxx: value; } 文本 */
function serializeOverrides(overrides: PartialThemeTokens): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) continue;
    lines.push(`  --lb-${key}: ${value};`);
  }
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '';
}

function writeStyle(): void {
  const el = ensureStyleEl();
  if (!el) return;
  // 预设先写全套，再叠加 override（override 优先级更高，因其后出现）
  const presetTokens: PartialThemeTokens =
    currentPreset === 'dark' ? DARK_PRESET : currentPreset === 'light' ? LIGHT_PRESET : {};
  const merged = { ...presetTokens, ...currentOverrides };
  el.textContent = serializeOverrides(merged);
}

function notify(): void {
  const snapshot = getCurrentTheme();
  for (const cb of listeners) {
    try {
      cb(snapshot);
    } catch {
      // 订阅者异常不应阻断主题系统
    }
  }
}

/**
 * 覆盖部分 token（与当前覆盖合并，不重置其他键）。
 * 传空对象会触发一次 notify（语义上等于"无变化通知"，调用方少见）。
 */
export function applyTheme(tokens: PartialThemeTokens): void {
  currentOverrides = { ...currentOverrides, ...tokens };
  // 清掉值为 null/undefined 的键（明确移除该覆盖）
  for (const [k, v] of Object.entries(currentOverrides)) {
    if (v == null) delete (currentOverrides as Record<string, unknown>)[k];
  }
  writeStyle();
  notify();
}

/**
 * 应用内置预设：先清覆盖（回默认），再写预设全套。
 * 之后仍可 applyTheme 叠加微调。
 */
export function applyThemePreset(name: LubanThemeName): void {
  currentPreset = name;
  currentOverrides = {};
  writeStyle();
  notify();
}

/**
 * 重置到 _variables.scss 默认（移除运行时 style 标签）。
 * clearPreset=true（默认）连预设也清，回到 SCSS 编译期默认。
 */
export function resetTheme(clearPreset = true): void {
  currentOverrides = {};
  if (clearPreset) currentPreset = null;
  if (isBrowser()) {
    const el = document.getElementById(STYLE_TAG_ID);
    if (el) el.textContent = '';
  }
  notify();
}

/**
 * 读当前生效 token快照。
 * 浏览器：从 document.documentElement 计算样式读 --lb-* 值（最权威）；
 * 无 document（SSR/单测）：用 LIGHT_PRESET + overrides 合成。
 */
export function getCurrentTheme(): Readonly<LubanThemeTokens> {
  if (isBrowser()) {
    const computed = getComputedStyle(document.documentElement);
    const out = {} as LubanThemeTokens;
    const keys = Object.keys(LIGHT_PRESET) as string[];
    for (const k of keys) {
      const v = computed.getPropertyValue(`--lb-${k}`).trim();
      // 计算样式读不到（如 SSR 注水前）时回退到预设
      (out as Record<string, unknown>)[k] = v || (LIGHT_PRESET as Record<string, string>)[k];
    }
    return out;
  }
  const preset = currentPreset === 'dark' ? DARK_PRESET : LIGHT_PRESET;
  return { ...preset, ...currentOverrides };
}

/** 订阅主题变更；返回取消订阅函数 */
export function onThemeChange(cb: (tokens: LubanThemeTokens) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 当前激活预设名（未应用预设返回 null） */
export function getCurrentPreset(): LubanThemeName | null {
  return currentPreset;
}
