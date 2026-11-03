import { describe, expect, it } from 'bun:test'

import { chooseImageShape, keepsHovercardOpen } from '../rules'

describe('chooseImageShape', () => {
  it('always covers under the cover layout', () => {
    expect(chooseImageShape('cover', { width: 400, height: 400 })).toBe('cover')
  })

  it('covers a wide, large picture under adaptive', () => {
    expect(chooseImageShape('adaptive', { width: 1200, height: 630 })).toBe('cover')
  })

  it('makes a thumb of a near-square picture', () => {
    expect(chooseImageShape('adaptive', { width: 460, height: 460 })).toBe('thumb')
  })

  it('makes a thumb of a narrow picture', () => {
    expect(chooseImageShape('adaptive', { width: 300, height: 157 })).toBe('thumb')
  })

  it('makes a thumb of a wide-enough picture with a low ratio', () => {
    expect(chooseImageShape('adaptive', { width: 640, height: 500 })).toBe('thumb')
  })

  it('covers when a size is missing', () => {
    expect(chooseImageShape('adaptive', { width: 1200 })).toBe('cover')
    expect(chooseImageShape('adaptive', undefined)).toBe('cover')
  })

  it('covers when a size is zero or negative', () => {
    expect(chooseImageShape('adaptive', { width: 0, height: 100 })).toBe('cover')
    expect(chooseImageShape('adaptive', { width: 100, height: -5 })).toBe('cover')
  })
})

type Flags = Partial<Omit<Parameters<typeof keepsHovercardOpen>[0], 'key' | 'getModifierState'>> & {
  altGraph?: boolean
}
const keyEvent = (key: string, { altGraph = false, ...flags }: Flags = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  ...flags,
  getModifierState: (k: string) => k === 'AltGraph' && altGraph
})
const press = (key: string, flags: Flags = {}, isMac = false) =>
  keepsHovercardOpen(keyEvent(key, flags), isMac)

describe('keepsHovercardOpen', () => {
  it('keeps the card for held modifiers and lock keys', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph'])
      expect(press(key), key).toBe(true)
  })

  it('keeps the card for move and function keys', () => {
    for (const key of ['ArrowLeft', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'F5', 'F12'])
      expect(press(key), key).toBe(true)
  })

  it('closes the card for F0 and F13 to F99', () => {
    for (const key of ['F0', 'F13', 'F24', 'F99']) expect(press(key), key).toBe(false)
  })

  it('keeps the card for Mod+C on macOS and not for Ctrl+C there', () => {
    expect(press('c', { metaKey: true }, true)).toBe(true)
    expect(press('C', { metaKey: true }, true)).toBe(true)
    expect(press('c', { ctrlKey: true }, true)).toBe(false)
  })

  it('keeps the card for Mod+C elsewhere and not for Meta+C there', () => {
    expect(press('c', { ctrlKey: true })).toBe(true)
    expect(press('C', { ctrlKey: true })).toBe(true)
    expect(press('c', { metaKey: true })).toBe(false)
  })

  it('closes the card for edit and plain keys', () => {
    for (const key of ['Escape', 'a', 'Enter', 'Backspace', 'Tab', 'Dead', 'Process'])
      expect(press(key), key).toBe(false)
  })

  it('closes the card for other Mod shortcuts', () => {
    for (const mac of [true, false]) {
      const mod: Flags = mac ? { metaKey: true } : { ctrlKey: true }
      for (const key of ['b', 'v', 'Z']) expect(press(key, mod, mac), `${mac} ${key}`).toBe(false)
    }
  })

  it('closes the card while an IME composes, even on a move key', () => {
    expect(press('a', { isComposing: true })).toBe(false)
    expect(press('ArrowLeft', { isComposing: true })).toBe(false)
  })

  it('treats AltGr as a plain key, never as Mod', () => {
    const altGr: Flags = { ctrlKey: true, altKey: true, altGraph: true }
    expect(press('@', altGr)).toBe(false)
    expect(press('c', altGr)).toBe(false)
    expect(press('c', { ctrlKey: true, altGraph: true })).toBe(false)
  })

  it('closes the card for Mod+Shift+C', () => {
    expect(press('C', { ctrlKey: true, shiftKey: true })).toBe(false)
    expect(press('C', { metaKey: true, shiftKey: true }, true)).toBe(false)
  })

  it('closes the card for Mod+Alt+C', () => {
    expect(press('c', { ctrlKey: true, altKey: true })).toBe(false)
    expect(press('c', { metaKey: true, altKey: true }, true)).toBe(false)
  })

  it('reads the platform itself when isMac is omitted', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const set = (platform: string) =>
      Object.defineProperty(globalThis, 'navigator', { value: { platform }, configurable: true })
    const ev = keyEvent('c', { metaKey: true })
    try {
      set('MacIntel')
      expect(keepsHovercardOpen(ev)).toBe(true)
      set('Win32')
      expect(keepsHovercardOpen(ev)).toBe(false)
    } finally {
      if (real) Object.defineProperty(globalThis, 'navigator', real)
      else delete (globalThis as { navigator?: unknown }).navigator
    }
  })
})
