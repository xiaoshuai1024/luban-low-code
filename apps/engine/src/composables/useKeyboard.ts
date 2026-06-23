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

export type ShortcutAction =
  | 'undo' | 'redo' | 'delete' | 'save' | 'duplicate'
  | 'lock' | 'hide' | 'copy' | 'paste' | 'escape'
  | 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack'
  | 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight'
  | null

export interface KeyboardHandlers {
  undo?: () => void
  redo?: () => void
  delete?: () => void
  save?: () => void
  duplicate?: () => void
  lock?: () => void
  hide?: () => void
  copy?: () => void
  paste?: () => void
  escape?: () => void
  bringForward?: () => void
  sendBackward?: () => void
  bringToFront?: () => void
  sendToBack?: () => void
  arrowUp?: (shift: boolean) => void
  arrowDown?: (shift: boolean) => void
  arrowLeft?: (shift: boolean) => void
  arrowRight?: (shift: boolean) => void
}

/** 纯函数：判定快捷键 → 动作（便于单测，不依赖 DOM 组件上下文） */
export function matchShortcut(e: KeyboardEvent, inputFocused: boolean): ShortcutAction {
  const ctrl = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  const shift = e.shiftKey
  // 输入态仅放行保存/撤销/重做/粘贴
  if (inputFocused && !(ctrl && (key === 's' || key === 'z' || key === 'y' || key === 'v'))) return null
  // Ctrl 组合
  if (ctrl && shift && key === 'z') return 'redo'
  if (ctrl && key === 'z') return 'undo'
  if (ctrl && key === 'y') return 'redo'
  if (ctrl && key === 's') return 'save'
  if (ctrl && key === 'd') return 'duplicate'
  if (ctrl && key === 'c') return 'copy'
  if (ctrl && key === 'v') return 'paste'
  if (ctrl && key === ']') return 'bringForward'
  if (ctrl && key === '[') return 'sendBackward'
  if (ctrl && shift && key === ']') return 'bringToFront'
  if (ctrl && shift && key === '[') return 'sendToBack'
  // 非 Ctrl 单键
  if (!ctrl) {
    if (key === 'delete' || key === 'backspace') return 'delete'
    if (key === 'escape') return 'escape'
    if (key === 'l') return 'lock'
    if (key === 'h') return 'hide'
    if (key === 'arrowup') return 'arrowUp'
    if (key === 'arrowdown') return 'arrowDown'
    if (key === 'arrowleft') return 'arrowLeft'
    if (key === 'arrowright') return 'arrowRight'
  }
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
      // 方向键 handler 接收 shift 参数（大步移动）
      if (action.startsWith('arrow')) {
        ;(handler as (shift: boolean) => void)(e.shiftKey)
      } else {
        ;(handler as () => void)()
      }
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onUnmounted(() => window.removeEventListener('keydown', onKey))
}
