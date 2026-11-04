import { hasMod, MODIFIER_KEYS } from '../interactions/modKey'
import type { HovercardData, HovercardImageLayout, ImageShape } from './types'

const THUMB_BELOW_RATIO = 1.3
const THUMB_BELOW_WIDTH = 320

/**
 * Under `adaptive`, a near-square or narrow picture becomes a thumb. A repo picture is
 * its owner avatar, so it is a tile at any small or unknown size, under either layout.
 */
export function chooseImageShape(
  layout: HovercardImageLayout,
  kind: HovercardData['kind'],
  size?: { width?: number; height?: number }
): ImageShape {
  const repo = kind === 'repo'
  const w = size?.width
  const h = size?.height
  if (!w || !h || w <= 0 || h <= 0) return repo ? 'tile' : 'cover'
  if (layout === 'cover' && !repo) return 'cover'
  if (w / h >= THUMB_BELOW_RATIO && w >= THUMB_BELOW_WIDTH) return 'cover'
  return repo ? 'tile' : 'thumb'
}

const MOVE_KEY = /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|F([1-9]|1[0-2]))$/

/**
 * True when the key leaves the card open: a held modifier, a move key,
 * or Mod+C. `isMac` is injectable so tests need no navigator stub.
 */
export function keepsHovercardOpen(
  e: Pick<
    KeyboardEvent,
    'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'isComposing' | 'getModifierState'
  >,
  isMac?: boolean
): boolean {
  if (e.isComposing) return false
  if (MODIFIER_KEYS.has(e.key) || MOVE_KEY.test(e.key)) return true
  return (
    hasMod(e, isMac) &&
    !e.altKey &&
    !e.shiftKey &&
    !e.getModifierState('AltGraph') &&
    e.key.toLowerCase() === 'c'
  )
}
