import { onMounted, onUnmounted } from 'vue'

/**
 * useKeyboard — 编辑器全局快捷键。
 *
 * Ctrl+S 保存 · Ctrl+Z 撤销 · Ctrl+Shift+Z / Ctrl+Y 重做
 * · Ctrl+D 复制 · Delete 删除选中
 *
 * 输入态（input/textarea/contenteditable）屏蔽 Delete/Ctrl+D（避免编辑文本误删节点），
 * 但保留 Ctrl+S/Z/Y（保存/撤销全局有效）。Ctrl+S 始终 preventDefault（禁浏览器另存）。
 */

export type ShortcutAction = 'undo' | 'redo' | 'delete' | 'save' | 'duplicate' | null

export interface KeyboardHandlers {
  undo?: () => void
  redo?: () => void
  delete?: () => void
  save?: () => void
  duplicate?: () => void
}

/** 纯函数：判定快捷键 → 动作（便于单测，不依赖 DOM 组件上下文） */
export function matchShortcut(e: KeyboardEvent, inputFocused: boolean): ShortcutAction {
  const ctrl = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  // 输入态仅放行保存/撤销/重做
  if (inputFocused && !(ctrl && (key === 's' || key === 'z' || key === 'y'))) return null
  if (ctrl && e.shiftKey && key === 'z') return 'redo'
  if (ctrl && key === 'z') return 'undo'
  if (ctrl && key === 'y') return 'redo'
  if (ctrl && key === 's') return 'save'
  if (ctrl && key === 'd') return 'duplicate'
  if (!ctrl && (key === 'delete' || key === 'backspace')) return 'delete'
  return null
}

function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
}

export function useKeyboard(handlers: KeyboardHandlers): void {
  function onKey(e: KeyboardEvent): void {
    const action = matchShortcut(e, isInputFocused())
    if (!action) return
    const handler = handlers[action]
    if (handler) {
      e.preventDefault()
      handler()
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onUnmounted(() => window.removeEventListener('keydown', onKey))
}
