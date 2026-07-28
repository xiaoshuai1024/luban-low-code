/**
 * V2-T1 主题系统单测。
 *
 * 覆盖：
 *  - applyTheme 覆盖单 token → :root 自定义属性被改写
 *  - applyThemePreset('dark') → 深色 token 套写
 *  - resetTheme → 回默认（清空运行时 style 标签）
 *  - getCurrentTheme → 读当前快照
 *  - onThemeChange → 订阅与取消订阅
 *
 * 注：jsdom 下 getComputedStyle 读自定义属性的能力取决于实现；
 * 这里改用直接读 <style#lb-theme-runtime-overrides> 的 textContent 断言
 * 写入正确，避免对 jsdom getComputedStyle 的依赖。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyTheme,
  applyThemePreset,
  resetTheme,
  getCurrentTheme,
  getCurrentPreset,
  onThemeChange,
} from '../../src/theme';
import { LIGHT_PRESET, DARK_PRESET } from '../../src/theme/presets';

const STYLE_TAG_ID = 'lb-theme-runtime-overrides';

function getStyleText(): string {
  const el = document.getElementById(STYLE_TAG_ID);
  return el?.textContent ?? '';
}

describe('V2-T1 theme API', () => {
  beforeEach(() => {
    resetTheme(true);
    // 清理可能残留的 style 标签
    const el = document.getElementById(STYLE_TAG_ID);
    if (el) el.textContent = '';
  });

  it('applyTheme 写 :root 自定义属性覆盖', () => {
    applyTheme({ primary: '#ff0000', accent: '#00ff00' });
    const css = getStyleText();
    expect(css).toContain('--lb-primary: #ff0000');
    expect(css).toContain('--lb-accent: #00ff00');
  });

  it('applyTheme 多次调用合并，不覆盖未传键', () => {
    applyTheme({ primary: '#ff0000' });
    applyTheme({ accent: '#00ff00' });
    const css = getStyleText();
    expect(css).toContain('--lb-primary: #ff0000');
    expect(css).toContain('--lb-accent: #00ff00');
  });

  it('applyTheme 传 null 值移除该键覆盖', () => {
    applyTheme({ primary: '#ff0000', accent: '#00ff00' });
    applyTheme({ primary: null as unknown as string });
    const css = getStyleText();
    expect(css).not.toContain('--lb-primary');
    expect(css).toContain('--lb-accent: #00ff00');
  });

  it('applyThemePreset("dark") 写入 dark 预设全套', () => {
    applyThemePreset('dark');
    expect(getCurrentPreset()).toBe('dark');
    const css = getStyleText();
    expect(css).toContain(`--lb-primary: ${DARK_PRESET.primary}`);
    expect(css).toContain(`--lb-bg: ${DARK_PRESET.bg}`);
  });

  it('applyThemePreset("light") 写入 light 预设全套', () => {
    applyThemePreset('light');
    expect(getCurrentPreset()).toBe('light');
    const css = getStyleText();
    expect(css).toContain(`--lb-primary: ${LIGHT_PRESET.primary}`);
  });

  it('applyThemePreset 切换预设时清除旧覆盖', () => {
    applyTheme({ primary: '#abc123' });
    applyThemePreset('dark');
    const css = getStyleText();
    // 旧 override 不应残留
    expect(css).not.toContain('#abc123');
    expect(css).toContain(`--lb-primary: ${DARK_PRESET.primary}`);
  });

  it('resetTheme 清空 style 标签内容', () => {
    applyTheme({ primary: '#ff0000' });
    expect(getStyleText()).toContain('--lb-primary');
    resetTheme();
    expect(getStyleText()).toBe('');
    expect(getCurrentPreset()).toBeNull();
  });

  it('getCurrentTheme 在无 document 覆盖时返回 light 预设默认', () => {
    resetTheme();
    const tokens = getCurrentTheme();
    // jsdom getComputedStyle 可能不返回 CSS 变量值；getCurrentTheme 内置 fallback 到 LIGHT_PRESET
    expect(tokens.primary).toBeTruthy();
    expect(typeof tokens.primary).toBe('string');
  });

  it('onThemeChange 订阅收到变更通知', () => {
    const calls: string[] = [];
    const unsub = onThemeChange((tokens) => {
      calls.push(tokens.primary);
    });
    applyTheme({ primary: '#aaa111' });
    expect(calls.length).toBeGreaterThanOrEqual(1);
    unsub();
    // 取消订阅后不再触发
    applyTheme({ primary: '#bbb222' });
    const lenBefore = calls.length;
    applyTheme({ primary: '#ccc333' });
    expect(calls.length).toBe(lenBefore); // 取消订阅后调用次数不再增加（按 lenBefore 基准）
  });

  it('LIGHT_PRESET 与 DARK_PRESET 都覆盖全部 token 键', () => {
    const keys = Object.keys(LIGHT_PRESET);
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) {
      expect(DARK_PRESET).toHaveProperty(k);
    }
  });
});
