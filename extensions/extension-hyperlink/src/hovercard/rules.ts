import { hasMod, MODIFIER_KEYS } from '../interactions/modKey'

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
