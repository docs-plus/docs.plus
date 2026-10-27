import { isMacOS } from '@tiptap/core'

import type { HovercardImageLayout } from './types'

const THUMB_BELOW_RATIO = 1.3
const THUMB_BELOW_WIDTH = 320

/** Under `adaptive`, a near-square or narrow picture would blow up, so it becomes a thumb. */
export function chooseImageShape(
  layout: HovercardImageLayout,
  size?: { width?: number; height?: number }
): 'cover' | 'thumb' {
  if (layout === 'cover') return 'cover'
  const w = size?.width
  const h = size?.height
  if (!w || !h || w <= 0 || h <= 0) return 'cover'
  return w / h < THUMB_BELOW_RATIO || w < THUMB_BELOW_WIDTH ? 'thumb' : 'cover'
}

const HELD_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph'])
const MOVE_KEY = /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|F([1-9]|1[0-2]))$/

/**
 * True when the key leaves the card open: a held modifier, a move key,
 * or Mod+C. `isMac` is injectable so tests need no navigator stub.
 */
export function keepsHovercardOpen(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'isComposing'> & {
    altGraph: boolean
  },
  isMac: boolean = isMacOS()
): boolean {
  if (e.isComposing) return false
  if (HELD_KEYS.has(e.key) || MOVE_KEY.test(e.key)) return true
  const mod = isMac ? e.metaKey : e.ctrlKey
  return mod && !e.altKey && !e.shiftKey && !e.altGraph && e.key.toLowerCase() === 'c'
}
