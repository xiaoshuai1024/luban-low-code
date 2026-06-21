import { describe, it, expect } from 'vitest'
import { matchShortcut } from './useKeyboard'

function key(k: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, ...opts })
}

describe('matchShortcut', () => {
  it('Ctrl+S → save', () => {
    expect(matchShortcut(key('s', { ctrlKey: true }), false)).toBe('save')
    expect(matchShortcut(key('s', { metaKey: true }), false)).toBe('save') // mac cmd
  })
  it('Ctrl+Z → undo; Ctrl+Shift+Z / Ctrl+Y → redo', () => {
    expect(matchShortcut(key('z', { ctrlKey: true }), false)).toBe('undo')
    expect(matchShortcut(key('z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo')
    expect(matchShortcut(key('y', { ctrlKey: true }), false)).toBe('redo')
  })
  it('Ctrl+D → duplicate; Delete/Backspace → delete', () => {
    expect(matchShortcut(key('d', { ctrlKey: true }), false)).toBe('duplicate')
    expect(matchShortcut(key('Delete'), false)).toBe('delete')
    expect(matchShortcut(key('Backspace'), false)).toBe('delete')
  })
  it('无修饰键的普通键 → null', () => {
    expect(matchShortcut(key('a'), false)).toBeNull()
    expect(matchShortcut(key('Enter'), false)).toBeNull()
  })
  it('输入态屏蔽 Delete/Duplicate，放行保存/撤销/重做', () => {
    expect(matchShortcut(key('Delete'), true)).toBeNull()
    expect(matchShortcut(key('d', { ctrlKey: true }), true)).toBeNull()
    expect(matchShortcut(key('s', { ctrlKey: true }), true)).toBe('save')
    expect(matchShortcut(key('z', { ctrlKey: true }), true)).toBe('undo')
    expect(matchShortcut(key('y', { ctrlKey: true }), true)).toBe('redo')
  })
  it('大小写不敏感', () => {
    expect(matchShortcut(key('S', { ctrlKey: true }), false)).toBe('save')
    expect(matchShortcut(key('Z', { ctrlKey: true }), false)).toBe('undo')
  })
})
