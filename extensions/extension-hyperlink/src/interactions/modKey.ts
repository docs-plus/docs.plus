import { isMacOS } from '@tiptap/core'

/** Keys that only modify another key, so pressing one alone is not a shortcut. */
export const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

/** The `KeyboardEvent.key` of the platform Mod key. */
export function modKeyName(): 'Meta' | 'Control' {
  return isMacOS() ? 'Meta' : 'Control'
}

/** True when the platform Mod key is held: Cmd on macOS, Ctrl elsewhere. */
export function hasMod(
  e: Pick<MouseEvent | KeyboardEvent, 'metaKey' | 'ctrlKey'>,
  isMac: boolean = isMacOS()
): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}
