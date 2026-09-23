import type { Editor } from '@tiptap/core'
import { useSyncExternalStore } from 'react'
import type { IconType } from 'react-icons'

export const SLASH_LISTBOX_ID = 'slash-menu-listbox'
export const slashOptionId = (index: number): string => `slash-menu-option-${index}`

export type SlashItem = {
  id: string
  label: string
  icon: IconType
  /** Short aliases a query may start with, such as `h3` or `ul`. */
  aliases: string[]
  can: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

type SlashSession = {
  items: SlashItem[]
  selectedIndex: number
  pick: (item: SlashItem) => void
}

// One session at a time. The desktop listbox and the phone sheet read the same state,
// so the plugin key handler and a tap both move and pick through here.
let session: SlashSession | null = null
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSlashSession(next: SlashSession | null): void {
  session = next
  emit()
}

export const slashSelectedIndex = (): number => session?.selectedIndex ?? 0

export function moveSlashSelection(delta: number): boolean {
  if (!session || session.items.length === 0) return false
  const count = session.items.length
  setSlashSession({ ...session, selectedIndex: (session.selectedIndex + delta + count) % count })
  return true
}

export function selectSlashIndex(index: number): void {
  if (!session || index === session.selectedIndex) return
  setSlashSession({ ...session, selectedIndex: index })
}

export function pickSlashIndex(index: number): boolean {
  const item = session?.items[index]
  if (!session || !item) return false
  session.pick(item)
  return true
}

/** False when nothing matches, so Enter keeps its normal meaning. */
export function pickSlashSelection(): boolean {
  return session ? pickSlashIndex(session.selectedIndex) : false
}

export const useSlashSession = (): SlashSession | null =>
  useSyncExternalStore(
    subscribe,
    () => session,
    () => null
  )
